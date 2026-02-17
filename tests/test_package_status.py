"""Tests for package status parsing (US0198).

Tests the package parser service that distinguishes between
upgradable and held-back packages.
"""

import pytest

from homelab_cmd.services.package_parser import (
    PackageInfo,
    categorise_packages,
    get_package_status_from_commands,
    parse_apt_list_upgradable,
    parse_apt_mark_showhold,
    parse_apt_policy_phased,
    parse_apt_simulate_kept_back,
)


class TestParseAptListUpgradable:
    """Tests for parsing apt list --upgradable output."""

    def test_parse_single_package(self):
        """Parse a single upgradable package."""
        output = """Listing... Done
nginx/jammy-updates 1.25.0-1ubuntu1 amd64 [upgradable from: 1.24.0-1ubuntu1]"""

        packages = parse_apt_list_upgradable(output)

        assert len(packages) == 1
        assert packages[0].name == "nginx"
        assert packages[0].current_version == "1.24.0-1ubuntu1"
        assert packages[0].candidate_version == "1.25.0-1ubuntu1"
        assert packages[0].repository == "jammy-updates"
        assert packages[0].status == "upgradable"
        assert packages[0].is_security is False

    def test_parse_multiple_packages(self):
        """Parse multiple upgradable packages."""
        output = """Listing... Done
firefox/jammy-updates 121.0+build1-0ubuntu0.22.04.1 amd64 [upgradable from: 120.0+build1-0ubuntu0.22.04.1]
nginx/jammy-security 1.24.0-1ubuntu1.1 amd64 [upgradable from: 1.24.0-1ubuntu1]
curl/jammy 7.81.0-1ubuntu1.16 amd64 [upgradable from: 7.81.0-1ubuntu1.15]"""

        packages = parse_apt_list_upgradable(output)

        assert len(packages) == 3
        assert packages[0].name == "firefox"
        assert packages[1].name == "nginx"
        assert packages[2].name == "curl"

    def test_detect_security_updates(self):
        """Detect security updates from repository name."""
        output = """Listing... Done
openssl/jammy-security 3.0.14-1~deb12u1 amd64 [upgradable from: 3.0.13-1~deb12u1]
nginx/bookworm-security 1.24.0-1 amd64 [upgradable from: 1.23.0-1]
curl/jammy 7.81.0-1 amd64 [upgradable from: 7.80.0-1]"""

        packages = parse_apt_list_upgradable(output)

        assert packages[0].is_security is True
        assert packages[1].is_security is True
        assert packages[2].is_security is False

    def test_empty_output(self):
        """Handle empty output (no upgrades available)."""
        output = """Listing... Done"""

        packages = parse_apt_list_upgradable(output)

        assert len(packages) == 0

    def test_parse_complex_version_strings(self):
        """Parse packages with complex version strings."""
        output = """Listing... Done
linux-image-5.15.0-91-generic/jammy-updates 5.15.0-91.101 amd64 [upgradable from: 5.15.0-90.100]"""

        packages = parse_apt_list_upgradable(output)

        assert len(packages) == 1
        assert packages[0].name == "linux-image-5.15.0-91-generic"
        assert packages[0].current_version == "5.15.0-90.100"
        assert packages[0].candidate_version == "5.15.0-91.101"


class TestParseAptMarkShowhold:
    """Tests for parsing apt-mark showhold output."""

    def test_parse_single_held_package(self):
        """Parse a single held package."""
        output = "linux-image-generic\n"

        held = parse_apt_mark_showhold(output)

        assert held == {"linux-image-generic"}

    def test_parse_multiple_held_packages(self):
        """Parse multiple held packages."""
        output = """linux-image-generic
linux-headers-generic
nvidia-driver-535"""

        held = parse_apt_mark_showhold(output)

        assert held == {"linux-image-generic", "linux-headers-generic", "nvidia-driver-535"}

    def test_empty_output(self):
        """Handle empty output (no packages held)."""
        output = ""

        held = parse_apt_mark_showhold(output)

        assert held == set()

    def test_whitespace_handling(self):
        """Handle whitespace in output."""
        output = """  linux-image-generic
  linux-headers-generic
"""

        held = parse_apt_mark_showhold(output)

        assert held == {"linux-image-generic", "linux-headers-generic"}


class TestParseAptSimulateKeptBack:
    """Tests for parsing apt-get dist-upgrade --simulate output."""

    def test_parse_kept_back_packages(self):
        """Parse packages kept back from simulation."""
        output = """Reading package lists... Done
Building dependency tree... Done
Calculating upgrade... Done
The following packages have been kept back:
  firefox linux-image-generic linux-headers-generic
0 upgraded, 0 newly installed, 0 to remove and 3 not upgraded."""

        kept_back = parse_apt_simulate_kept_back(output)

        assert kept_back == {"firefox", "linux-image-generic", "linux-headers-generic"}

    def test_kept_back_multiline(self):
        """Parse kept back packages spanning multiple lines."""
        output = """Reading package lists... Done
Building dependency tree... Done
Calculating upgrade... Done
The following packages have been kept back:
  firefox linux-image-generic
  linux-headers-generic nvidia-driver-535
0 upgraded, 0 newly installed, 0 to remove and 4 not upgraded."""

        kept_back = parse_apt_simulate_kept_back(output)

        assert kept_back == {
            "firefox",
            "linux-image-generic",
            "linux-headers-generic",
            "nvidia-driver-535",
        }

    def test_no_packages_kept_back(self):
        """Handle output when no packages are kept back."""
        output = """Reading package lists... Done
Building dependency tree... Done
Calculating upgrade... Done
The following packages will be upgraded:
  nginx curl
2 upgraded, 0 newly installed, 0 to remove and 0 not upgraded."""

        kept_back = parse_apt_simulate_kept_back(output)

        assert kept_back == set()

    def test_empty_output(self):
        """Handle empty output."""
        output = ""

        kept_back = parse_apt_simulate_kept_back(output)

        assert kept_back == set()


class TestParseAptPolicyPhased:
    """Tests for parsing apt policy output for phased rollouts."""

    def test_detect_phased_rollout(self):
        """Detect phased rollout percentage."""
        output = """firefox:
  Installed: 120.0+build1-0ubuntu0.22.04.1
  Candidate: 121.0+build1-0ubuntu0.22.04.1
  Version table:
     121.0+build1-0ubuntu0.22.04.1 500 (phased 45%)
        500 http://archive.ubuntu.com/ubuntu jammy-updates/main amd64 Packages
 *** 120.0+build1-0ubuntu0.22.04.1 100
        100 /var/lib/dpkg/status"""

        pct = parse_apt_policy_phased(output, "firefox")

        assert pct == 45

    def test_no_phased_rollout(self):
        """Handle package without phased rollout."""
        output = """nginx:
  Installed: 1.24.0-1
  Candidate: 1.25.0-1
  Version table:
     1.25.0-1 500
        500 http://archive.ubuntu.com/ubuntu jammy-updates/main amd64 Packages
 *** 1.24.0-1 100
        100 /var/lib/dpkg/status"""

        pct = parse_apt_policy_phased(output, "nginx")

        assert pct is None

    def test_phased_100_percent(self):
        """Handle 100% phased rollout (fully deployed)."""
        output = """firefox:
  Installed: 120.0
  Candidate: 121.0
  Version table:
     121.0 500 (phased 100%)"""

        pct = parse_apt_policy_phased(output, "firefox")

        assert pct == 100

    def test_phased_0_percent(self):
        """Handle 0% phased rollout (just started)."""
        output = """firefox:
  Installed: 120.0
  Candidate: 121.0
  Version table:
     121.0 500 (phased 0%)"""

        pct = parse_apt_policy_phased(output, "firefox")

        assert pct == 0

    def test_multi_package_output(self):
        """Parse correct percentage from multi-package apt policy output."""
        # When apt policy is called with multiple packages, each has its own section
        output = """libosmesa6:
  Installed: 25.0.7-0ubuntu0.24.04.2
  Candidate: 25.1.7-1ubuntu2~24.04.1
  Version table:
     25.1.7-1ubuntu2~24.04.1 500 (phased 30%)
        500 http://archive.ubuntu.com/ubuntu noble-updates/main amd64 Packages
 *** 25.0.7-0ubuntu0.24.04.2 100
        100 /var/lib/dpkg/status
nvidia-driver-550:
  Installed: 550.163.01-0ubuntu0.24.04.2
  Candidate: 550.163.01-0ubuntu1
  Version table:
     550.163.01-0ubuntu1 500 (phased 50%)
        500 http://archive.ubuntu.com/ubuntu noble-updates/restricted amd64 Packages
 *** 550.163.01-0ubuntu0.24.04.2 100
        100 /var/lib/dpkg/status"""

        # Should get the correct percentage for each package
        pct_libosmesa = parse_apt_policy_phased(output, "libosmesa6")
        pct_nvidia = parse_apt_policy_phased(output, "nvidia-driver-550")

        assert pct_libosmesa == 30
        assert pct_nvidia == 50

    def test_package_not_in_output(self):
        """Return None when package is not in output."""
        output = """firefox:
  Installed: 120.0
  Candidate: 121.0
  Version table:
     121.0 500 (phased 45%)"""

        pct = parse_apt_policy_phased(output, "nonexistent-package")

        assert pct is None


class TestCategorisePackages:
    """Tests for package categorisation logic."""

    def test_all_upgradable(self):
        """All packages are upgradable."""
        upgradable = [
            PackageInfo(
                name="nginx",
                current_version="1.24.0",
                candidate_version="1.25.0",
                status="upgradable",
                repository="jammy-updates",
                is_security=False,
            ),
            PackageInfo(
                name="curl",
                current_version="7.80.0",
                candidate_version="7.81.0",
                status="upgradable",
                repository="jammy",
                is_security=False,
            ),
        ]

        result = categorise_packages(upgradable, set(), set(), {})

        assert result.upgradable_count == 2
        assert result.held_back_count == 0
        assert all(p.status == "upgradable" for p in result.packages)

    def test_manual_hold(self):
        """Package manually held via apt-mark."""
        upgradable = [
            PackageInfo(
                name="nginx",
                current_version="1.24.0",
                candidate_version="1.25.0",
                status="upgradable",
                repository="jammy-updates",
                is_security=False,
            ),
        ]

        result = categorise_packages(upgradable, {"nginx"}, set(), {})

        assert result.upgradable_count == 0
        assert result.held_back_count == 1
        assert result.packages[0].status == "held_back"
        assert result.packages[0].hold_reason == "manual"

    def test_phased_rollout(self):
        """Package in phased rollout."""
        upgradable = [
            PackageInfo(
                name="firefox",
                current_version="120.0",
                candidate_version="121.0",
                status="upgradable",
                repository="jammy-updates",
                is_security=False,
            ),
        ]

        result = categorise_packages(
            upgradable,
            set(),
            {"firefox"},  # kept back
            {"firefox": 45},  # phased at 45%
        )

        assert result.upgradable_count == 0
        assert result.held_back_count == 1
        assert result.packages[0].status == "held_back"
        assert result.packages[0].hold_reason == "phased"
        assert result.packages[0].phased_percentage == 45

    def test_dependency_conflict(self):
        """Package held back due to dependency conflict."""
        upgradable = [
            PackageInfo(
                name="linux-image-generic",
                current_version="5.15.0-90",
                candidate_version="5.15.0-91",
                status="upgradable",
                repository="jammy-updates",
                is_security=False,
            ),
        ]

        result = categorise_packages(
            upgradable,
            set(),
            {"linux-image-generic"},  # kept back but not phased
            {},  # no phased info
        )

        assert result.packages[0].hold_reason == "dependency"

    def test_mixed_packages(self):
        """Mix of upgradable and held-back packages."""
        upgradable = [
            PackageInfo(
                name="nginx",
                current_version="1.24.0",
                candidate_version="1.25.0",
                status="upgradable",
                repository="jammy-updates",
                is_security=False,
            ),
            PackageInfo(
                name="firefox",
                current_version="120.0",
                candidate_version="121.0",
                status="upgradable",
                repository="jammy-updates",
                is_security=False,
            ),
            PackageInfo(
                name="curl",
                current_version="7.80.0",
                candidate_version="7.81.0",
                status="upgradable",
                repository="jammy-security",
                is_security=True,
            ),
        ]

        result = categorise_packages(
            upgradable,
            set(),
            {"firefox"},
            {"firefox": 30},
        )

        assert result.upgradable_count == 2
        assert result.held_back_count == 1
        assert result.security_count == 1

        # Check each package
        by_name = {p.name: p for p in result.packages}
        assert by_name["nginx"].status == "upgradable"
        assert by_name["firefox"].status == "held_back"
        assert by_name["firefox"].hold_reason == "phased"
        assert by_name["curl"].status == "upgradable"
        assert by_name["curl"].is_security is True

    def test_security_count(self):
        """Security updates are counted correctly."""
        upgradable = [
            PackageInfo(
                name="openssl",
                current_version="3.0.13",
                candidate_version="3.0.14",
                status="upgradable",
                repository="jammy-security",
                is_security=True,
            ),
            PackageInfo(
                name="libssl3",
                current_version="3.0.13",
                candidate_version="3.0.14",
                status="upgradable",
                repository="jammy-security",
                is_security=True,
            ),
            PackageInfo(
                name="nginx",
                current_version="1.24.0",
                candidate_version="1.25.0",
                status="upgradable",
                repository="jammy-updates",
                is_security=False,
            ),
        ]

        result = categorise_packages(upgradable, set(), set(), {})

        assert result.security_count == 2


class TestGetPackageStatusFromCommands:
    """Tests for the main entry point function."""

    @pytest.mark.asyncio
    async def test_full_workflow(self):
        """Test full workflow with all apt outputs."""
        apt_list = """Listing... Done
nginx/jammy-updates 1.25.0-1 amd64 [upgradable from: 1.24.0-1]
firefox/jammy-updates 121.0-1 amd64 [upgradable from: 120.0-1]
curl/jammy-security 7.81.0-1 amd64 [upgradable from: 7.80.0-1]"""

        apt_mark = "linux-image-generic\n"

        apt_simulate = """Reading package lists... Done
The following packages have been kept back:
  firefox
0 upgraded, 0 newly installed, 0 to remove and 1 not upgraded."""

        result = await get_package_status_from_commands(
            apt_list_output=apt_list,
            apt_mark_output=apt_mark,
            apt_simulate_output=apt_simulate,
        )

        assert result.upgradable_count == 2
        assert result.held_back_count == 1
        assert result.security_count == 1

        by_name = {p.name: p for p in result.packages}
        assert by_name["nginx"].status == "upgradable"
        assert by_name["firefox"].status == "held_back"
        assert by_name["curl"].status == "upgradable"
        assert by_name["curl"].is_security is True

    @pytest.mark.asyncio
    async def test_empty_outputs(self):
        """Handle case where no packages are upgradable."""
        result = await get_package_status_from_commands(
            apt_list_output="Listing... Done\n",
            apt_mark_output="",
            apt_simulate_output="",
        )

        assert result.upgradable_count == 0
        assert result.held_back_count == 0
        assert result.security_count == 0
        assert result.packages == []
