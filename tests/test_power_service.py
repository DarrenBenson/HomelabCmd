"""Tests for power estimation service.

US0054 - TS0013 - Machine Category Power Profiles Tests.
"""

import pytest

from homelab_cmd.services.power import (
    POWER_PROFILES,
    MachineCategory,
    PowerProfile,
    calculate_daily_cost,
    calculate_daily_kwh,
    calculate_power_watts,
    get_power_config,
    infer_category_from_cpu,
)


class TestMachineCategoryEnum:
    """Tests for MachineCategory enum (US0054 - AC1 - TC200)."""

    def test_enum_has_nine_members(self) -> None:
        """TC200: MachineCategory enum has exactly 9 members."""
        assert len(MachineCategory) == 9

    def test_enum_values_match_specification(self) -> None:
        """TC200: All category values match specification."""
        expected = {
            "sbc",
            "mini_pc",
            "nas",
            "office_desktop",
            "gaming_desktop",
            "workstation",
            "office_laptop",
            "gaming_laptop",
            "rack_server",
        }
        actual = {cat.value for cat in MachineCategory}
        assert actual == expected

    def test_enum_is_string_enum(self) -> None:
        """Enum values are strings for JSON serialisation."""
        for cat in MachineCategory:
            assert isinstance(cat.value, str)


class TestPowerProfiles:
    """Tests for POWER_PROFILES dict (US0054 - AC2 - TC201, TC202)."""

    def test_power_profiles_has_all_categories(self) -> None:
        """TC201: POWER_PROFILES has entry for each category."""
        for category in MachineCategory:
            assert category in POWER_PROFILES

    def test_power_profiles_are_power_profile_type(self) -> None:
        """TC201: Each entry is a PowerProfile."""
        for profile in POWER_PROFILES.values():
            assert isinstance(profile, PowerProfile)

    def test_power_profiles_have_required_fields(self) -> None:
        """TC201: Each entry has label, idle_watts, max_watts."""
        for profile in POWER_PROFILES.values():
            assert isinstance(profile.label, str)
            assert len(profile.label) > 0
            assert isinstance(profile.idle_watts, int)
            assert isinstance(profile.max_watts, int)
            assert profile.idle_watts >= 0
            assert profile.max_watts > profile.idle_watts

    @pytest.mark.parametrize(
        "category,expected_idle,expected_max",
        [
            (MachineCategory.SBC, 2, 6),
            (MachineCategory.MINI_PC, 10, 25),
            (MachineCategory.NAS, 15, 35),
            (MachineCategory.OFFICE_DESKTOP, 40, 100),
            (MachineCategory.GAMING_DESKTOP, 75, 300),
            (MachineCategory.WORKSTATION, 100, 350),
            (MachineCategory.OFFICE_LAPTOP, 10, 30),
            (MachineCategory.GAMING_LAPTOP, 30, 100),
            (MachineCategory.RACK_SERVER, 100, 300),
        ],
    )
    def test_power_profile_values_match_specification(
        self, category: MachineCategory, expected_idle: int, expected_max: int
    ) -> None:
        """TC202: Power profile values match specification."""
        profile = POWER_PROFILES[category]
        assert profile.idle_watts == expected_idle
        assert profile.max_watts == expected_max


class TestInferCategoryFromCpu:
    """Tests for infer_category_from_cpu() (US0054 - AC3 - TC203-TC214, TC220)."""

    # TC203: ARM architecture detected as SBC
    @pytest.mark.parametrize(
        "cpu_model,architecture",
        [
            (None, "aarch64"),
            (None, "armv7l"),
            (None, "armv6l"),
            (None, "arm64"),
            ("Raspberry Pi 4 Model B Rev 1.4", "aarch64"),
            ("BCM2711", "arm64"),
            ("Cortex-A72", "aarch64"),
            ("Allwinner H6", "aarch64"),
            ("Rockchip RK3399", "aarch64"),
        ],
    )
    def test_arm_detected_as_sbc(self, cpu_model: str | None, architecture: str) -> None:
        """TC203: ARM architecture detected as SBC."""
        result = infer_category_from_cpu(cpu_model, architecture)
        assert result == MachineCategory.SBC

    # TC204: Xeon detected as Rack Server
    @pytest.mark.parametrize(
        "cpu_model",
        [
            "Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz",
            "Intel Xeon Gold 6226R",
            "Intel(R) Xeon(R) Gold 5218 CPU",
            "Intel Xeon E-2288G",
        ],
    )
    def test_xeon_detected_as_rack_server(self, cpu_model: str) -> None:
        """TC204: Xeon detected as Rack Server."""
        result = infer_category_from_cpu(cpu_model, "x86_64")
        assert result == MachineCategory.RACK_SERVER

    # TC205: EPYC detected as Rack Server
    @pytest.mark.parametrize(
        "cpu_model",
        [
            "AMD EPYC 7742 64-Core Processor",
            "AMD EPYC 9654",
            "AMD EPYC 7502",
        ],
    )
    def test_epyc_detected_as_rack_server(self, cpu_model: str) -> None:
        """TC205: EPYC detected as Rack Server."""
        result = infer_category_from_cpu(cpu_model, "x86_64")
        assert result == MachineCategory.RACK_SERVER

    # TC206: Mobile CPU detected as Office Laptop
    @pytest.mark.parametrize(
        "cpu_model",
        [
            "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz",
            "Intel(R) Core(TM) i7-10510U CPU @ 1.80GHz",
            "Intel Core i5-1235P",
            "Intel Core i7-1165G7",
            "Intel Core i5-1035G1",
            "AMD Ryzen 5 5500U",
            "AMD Ryzen 7 PRO 4750U",
            "AMD Ryzen 5 Mobile",
        ],
    )
    def test_mobile_cpu_detected_as_office_laptop(self, cpu_model: str) -> None:
        """TC206: Mobile CPU detected as Office Laptop."""
        result = infer_category_from_cpu(cpu_model, "x86_64")
        assert result == MachineCategory.OFFICE_LAPTOP

    # TC207: Desktop i3/i5 detected as Office Desktop
    @pytest.mark.parametrize(
        "cpu_model",
        [
            "Intel(R) Core(TM) i5-12400 CPU",
            "Intel(R) Core(TM) i5-10400F CPU @ 2.90GHz",
            "Intel Core i3-10100",
            "Intel(R) Core(TM) i3-8100 CPU @ 3.60GHz",
            "AMD Ryzen 5 5600X 6-Core Processor",
            "AMD Ryzen 5 3600",
            "AMD Ryzen 3 3200G",
        ],
    )
    def test_desktop_i3_i5_ryzen_3_5_detected_as_office_desktop(self, cpu_model: str) -> None:
        """TC207: Desktop i3/i5 detected as Office Desktop."""
        result = infer_category_from_cpu(cpu_model, "x86_64")
        assert result == MachineCategory.OFFICE_DESKTOP

    # TC208: Desktop i7/i9 detected as Workstation
    @pytest.mark.parametrize(
        "cpu_model",
        [
            "Intel(R) Core(TM) i9-13900K CPU",
            "Intel(R) Core(TM) i9-12900K",
            "Intel Core i7-12700K",
            "Intel(R) Core(TM) i7-10700 CPU @ 2.90GHz",
            "AMD Ryzen 9 7950X 16-Core Processor",
            "AMD Ryzen 9 5900X",
            "AMD Ryzen 7 5800X 8-Core Processor",
            "AMD Ryzen 7 3700X",
        ],
    )
    def test_desktop_i7_i9_ryzen_7_9_detected_as_workstation(self, cpu_model: str) -> None:
        """TC208: Desktop i7/i9 detected as Workstation."""
        result = infer_category_from_cpu(cpu_model, "x86_64")
        assert result == MachineCategory.WORKSTATION

    # TC209: N-series detected as Mini PC
    @pytest.mark.parametrize(
        "cpu_model",
        [
            "Intel N100",
            "Intel(R) N5095",
            "Intel(R) N5105 @ 2.00GHz",
            "Intel N4100",
        ],
    )
    def test_n_series_detected_as_mini_pc(self, cpu_model: str) -> None:
        """TC209: N-series detected as Mini PC."""
        result = infer_category_from_cpu(cpu_model, "x86_64")
        assert result == MachineCategory.MINI_PC

    # TC210: Celeron detected as Mini PC
    @pytest.mark.parametrize(
        "cpu_model",
        [
            "Intel Celeron J4125",
            "Intel(R) Celeron(R) N4100 CPU @ 1.10GHz",
            "Intel(R) Celeron(R) J4005 CPU",
        ],
    )
    def test_celeron_detected_as_mini_pc(self, cpu_model: str) -> None:
        """TC210: Celeron detected as Mini PC."""
        result = infer_category_from_cpu(cpu_model, "x86_64")
        assert result == MachineCategory.MINI_PC

    # TC211: Atom detected as Mini PC
    @pytest.mark.parametrize(
        "cpu_model",
        [
            "Intel Atom x5-Z8350",
            "Intel(R) Atom(TM) CPU E3845 @ 1.91GHz",
        ],
    )
    def test_atom_detected_as_mini_pc(self, cpu_model: str) -> None:
        """TC211: Atom detected as Mini PC."""
        result = infer_category_from_cpu(cpu_model, "x86_64")
        assert result == MachineCategory.MINI_PC

    # TC212: Pentium detected as Mini PC
    @pytest.mark.parametrize(
        "cpu_model",
        [
            "Intel Pentium Silver N6000",
            "Intel(R) Pentium(R) Gold G6400",
        ],
    )
    def test_pentium_detected_as_mini_pc(self, cpu_model: str) -> None:
        """TC212: Pentium detected as Mini PC."""
        result = infer_category_from_cpu(cpu_model, "x86_64")
        assert result == MachineCategory.MINI_PC

    # TC213: Unknown CPU returns None
    @pytest.mark.parametrize(
        "cpu_model,architecture",
        [
            ("Unknown CPU Model", "x86_64"),
            ("Some Random Processor", "x86_64"),
            (None, "x86_64"),
            (None, None),
        ],
    )
    def test_unknown_cpu_returns_none(
        self, cpu_model: str | None, architecture: str | None
    ) -> None:
        """TC213: Unknown CPU returns None."""
        result = infer_category_from_cpu(cpu_model, architecture)
        assert result is None

    # TC214: Apple M1/M2 detected as Office Laptop
    @pytest.mark.parametrize(
        "cpu_model",
        [
            "Apple M1",
            "Apple M2",
            "Apple M3 Pro",
        ],
    )
    def test_apple_m_series_detected_as_office_laptop(self, cpu_model: str) -> None:
        """TC214: Apple M-series detected as Office Laptop."""
        result = infer_category_from_cpu(cpu_model, "arm64")
        assert result == MachineCategory.OFFICE_LAPTOP

    # TC220: Threadripper detected as Workstation
    @pytest.mark.parametrize(
        "cpu_model",
        [
            "AMD Ryzen Threadripper 3960X 24-Core Processor",
            "AMD Ryzen Threadripper PRO 5995WX",
        ],
    )
    def test_threadripper_detected_as_workstation(self, cpu_model: str) -> None:
        """TC220: Threadripper detected as Workstation."""
        result = infer_category_from_cpu(cpu_model, "x86_64")
        assert result == MachineCategory.WORKSTATION


class TestGetPowerConfig:
    """Tests for get_power_config() function."""

    def test_returns_category_defaults(self) -> None:
        """Returns category default idle/max when no overrides."""
        config = get_power_config(
            machine_category="office_desktop",
            machine_category_source="auto",
            idle_watts_override=None,
            tdp_watts_override=None,
        )
        assert config is not None
        assert config.category == MachineCategory.OFFICE_DESKTOP
        assert config.category_source == "auto"
        assert config.idle_watts == 40
        assert config.max_watts == 100

    def test_idle_watts_override_takes_precedence(self) -> None:
        """User idle_watts override takes precedence over category default."""
        config = get_power_config(
            machine_category="office_desktop",
            machine_category_source="user",
            idle_watts_override=50,
            tdp_watts_override=None,
        )
        assert config is not None
        assert config.idle_watts == 50
        assert config.max_watts == 100  # Category default

    def test_max_watts_override_takes_precedence(self) -> None:
        """User tdp_watts override takes precedence over category default."""
        config = get_power_config(
            machine_category="office_desktop",
            machine_category_source="user",
            idle_watts_override=None,
            tdp_watts_override=150,
        )
        assert config is not None
        assert config.idle_watts == 40  # Category default
        assert config.max_watts == 150

    def test_both_overrides_take_precedence(self) -> None:
        """Both overrides take precedence over category defaults."""
        config = get_power_config(
            machine_category="sbc",
            machine_category_source="user",
            idle_watts_override=5,
            tdp_watts_override=15,
        )
        assert config is not None
        assert config.idle_watts == 5
        assert config.max_watts == 15

    def test_returns_none_without_category_or_overrides(self) -> None:
        """Returns None when no category and no overrides."""
        config = get_power_config(
            machine_category=None,
            machine_category_source=None,
            idle_watts_override=None,
            tdp_watts_override=None,
        )
        assert config is None

    def test_returns_none_for_invalid_category(self) -> None:
        """Returns None for invalid category without overrides."""
        config = get_power_config(
            machine_category="invalid_category",
            machine_category_source="auto",
            idle_watts_override=None,
            tdp_watts_override=None,
        )
        assert config is None

    def test_returns_config_with_overrides_only(self) -> None:
        """Returns config when both overrides provided without category."""
        config = get_power_config(
            machine_category=None,
            machine_category_source=None,
            idle_watts_override=20,
            tdp_watts_override=80,
        )
        assert config is not None
        assert config.category is None
        assert config.idle_watts == 20
        assert config.max_watts == 80


class TestCalculatePowerWatts:
    """Tests for calculate_power_watts() function."""

    def test_idle_at_zero_percent_cpu(self) -> None:
        """At 0% CPU, power equals idle watts."""
        result = calculate_power_watts(idle_watts=10, max_watts=100, cpu_percent=0.0)
        assert result == 10.0

    def test_max_at_100_percent_cpu(self) -> None:
        """At 100% CPU, power equals max watts."""
        result = calculate_power_watts(idle_watts=10, max_watts=100, cpu_percent=100.0)
        assert result == 100.0

    def test_interpolation_at_50_percent(self) -> None:
        """At 50% CPU, power is midpoint."""
        result = calculate_power_watts(idle_watts=10, max_watts=100, cpu_percent=50.0)
        assert result == 55.0

    def test_interpolation_at_25_percent(self) -> None:
        """At 25% CPU, power is 25% of range above idle."""
        result = calculate_power_watts(idle_watts=10, max_watts=100, cpu_percent=25.0)
        # 10 + (100-10) * 0.25 = 10 + 22.5 = 32.5
        assert result == 32.5

    def test_clamps_negative_cpu_to_zero(self) -> None:
        """Negative CPU percentage is clamped to 0."""
        result = calculate_power_watts(idle_watts=10, max_watts=100, cpu_percent=-10.0)
        assert result == 10.0

    def test_clamps_over_100_cpu_to_100(self) -> None:
        """CPU percentage over 100 is clamped to 100."""
        result = calculate_power_watts(idle_watts=10, max_watts=100, cpu_percent=150.0)
        assert result == 100.0


class TestCalculateDailyKwh:
    """Tests for calculate_daily_kwh() function."""

    def test_converts_watts_to_daily_kwh(self) -> None:
        """Correctly converts watts to daily kWh."""
        # 100W * 24h = 2400 Wh = 2.4 kWh
        result = calculate_daily_kwh(power_watts=100.0)
        assert result == 2.4

    def test_low_power_device(self) -> None:
        """Correctly calculates for low power device."""
        # 5W * 24h = 120 Wh = 0.12 kWh
        result = calculate_daily_kwh(power_watts=5.0)
        assert result == 0.12


class TestCalculateDailyCost:
    """Tests for calculate_daily_cost() function."""

    def test_calculates_daily_cost(self) -> None:
        """Correctly calculates daily electricity cost."""
        # 100W * 24h = 2.4 kWh * $0.30/kWh = $0.72
        result = calculate_daily_cost(power_watts=100.0, rate_per_kwh=0.30)
        assert result == 0.72

    def test_rounds_to_two_decimal_places(self) -> None:
        """Result is rounded to 2 decimal places."""
        result = calculate_daily_cost(power_watts=55.5, rate_per_kwh=0.27)
        # 55.5 * 24 / 1000 * 0.27 = 0.35964
        assert result == 0.36
