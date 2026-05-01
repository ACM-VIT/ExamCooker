# ExamCooker CLI

The official command-line client for [ExamCooker](https://examcooker.acmvit.in).

Use it to:

- sign in from your terminal
- search courses and past papers
- inspect and download papers
- upload PDFs to your ExamCooker account

## Install

```bash
npm install -g examcooker
```

## Quick start

```bash
examcooker auth login
examcooker whoami
examcooker courses search "distributed systems"
examcooker papers search --course BCSE409L
examcooker papers download <paper-id-or-url>
examcooker papers upload ./fat.pdf --course BCSE409L --exam-type FAT --year 2025
```

## Configuration

The CLI stores its session in:

- Linux/macOS: `~/.config/examcooker/config.json`
- XDG environments: `$XDG_CONFIG_HOME/examcooker/config.json`

Optional environment variables:

- `EXAMCOOKER_BASE_URL` to point the CLI at a different deployment
- `EXAMCOOKER_TOKEN` to override the stored auth token

## Commands

```text
auth login                Start browser-based CLI login
auth logout               Revoke the current CLI token and clear local auth
whoami                    Show the currently authenticated ExamCooker account
courses search [query]    Search ExamCooker courses
papers search [query]     Browse past papers
papers view [paper]       Inspect a paper
papers download [paper]   Save a paper PDF locally
papers upload <file>      Upload a past paper PDF
```

Run `examcooker --help` for the full interactive help output.
