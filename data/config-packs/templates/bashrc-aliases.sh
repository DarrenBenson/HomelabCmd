# Common shell aliases and functions
# Managed by HomelabCmd - do not edit manually

# Navigation
alias ..='cd ..'
alias ...='cd ../..'
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'

# Safety
alias rm='rm -i'
alias cp='cp -i'
alias mv='mv -i'

# Git shortcuts
alias gs='git status'
alias ga='git add'
alias gc='git commit'
alias gp='git push'
alias gl='git log --oneline -10'
alias gd='git diff'

# Docker shortcuts
alias dps='docker ps'
alias dpa='docker ps -a'
alias di='docker images'

# System
alias df='df -h'
alias du='du -h'
alias free='free -h'

# Grep with colour
alias grep='grep --color=auto'
alias fgrep='fgrep --color=auto'
alias egrep='egrep --color=auto'
