import figlet from "figlet";
import pc from "picocolors";

type Rgb = {
  r: number;
  g: number;
  b: number;
};

type BannerFont = {
  font: string;
  gap: string;
};

const RESET = "\x1b[0m";
const EXAM_TOP: Rgb = { r: 226, g: 232, b: 240 };
const EXAM_BOTTOM: Rgb = { r: 100, g: 116, b: 139 };
const COOKER_START: Rgb = { r: 37, g: 62, b: 224 };
const COOKER_END: Rgb = { r: 39, g: 186, b: 236 };

const BANNER_FONTS: BannerFont[] = [
  { font: "ANSI Shadow", gap: "  " },
  { font: "Small Slant", gap: "  " },
  { font: "Small", gap: " " },
];

const BANNER_COMMANDS = [
  {
    command: "examcooker",
    description: "Open guided mode",
  },
  {
    command: "examcooker auth login",
    description: "Connect your account",
  },
  {
    command: "examcooker papers search complex",
    description: "Pick a course, filter exams, browse papers",
  },
  {
    command: "examcooker papers upload ./fat.pdf",
    description: "Guided paper upload",
  },
];

function shouldUseAnsiColor() {
  return Boolean(process.stdout.isTTY && !process.env.NO_COLOR);
}

function toAnsiColor(color: Rgb) {
  return `\x1b[38;2;${color.r};${color.g};${color.b}m`;
}

function mixColor(start: Rgb, end: Rgb, ratio: number): Rgb {
  return {
    r: Math.round(start.r + (end.r - start.r) * ratio),
    g: Math.round(start.g + (end.g - start.g) * ratio),
    b: Math.round(start.b + (end.b - start.b) * ratio),
  };
}

function trimBottomWhitespace(lines: string[]) {
  const nextLines = [...lines];

  while (nextLines.length > 0 && nextLines.at(-1)?.trim() === "") {
    nextLines.pop();
  }

  return nextLines;
}

function getFigletLines(text: string, font: string) {
  return trimBottomWhitespace(figlet.textSync(text, { font }).split("\n"));
}

function getVisibleWidth(lines: string[]) {
  return Math.max(...lines.map((line) => line.length), 0);
}

function gradientRatio(x: number, y: number, width: number, height: number) {
  const horizontal = width <= 1 ? 1 : x / (width - 1);
  const vertical = height <= 1 ? 1 : (height - 1 - y) / (height - 1);

  return Math.max(0, Math.min(1, (horizontal + vertical) / 2));
}

function colorizeBlock(
  lines: string[],
  start: Rgb,
  end: Rgb,
  mode: "diagonal" | "vertical",
) {
  if (!shouldUseAnsiColor()) {
    return lines;
  }

  const height = lines.length;
  const width = getVisibleWidth(lines);

  return lines.map((line, y) => {
    let nextLine = "";

    for (let x = 0; x < line.length; x += 1) {
      const char = line[x];
      if (char === " ") {
        nextLine += `${RESET} `;
        continue;
      }

      const ratio =
        mode === "vertical"
          ? height <= 1
            ? 1
            : y / (height - 1)
          : gradientRatio(x, y, width, height);

      nextLine += `${toAnsiColor(mixColor(start, end, ratio))}${char}`;
    }

    return `${nextLine}${RESET}`;
  });
}

function measureWordmark(font: BannerFont) {
  const examLines = getFigletLines("Exam", font.font);
  const cookerLines = getFigletLines("Cooker", font.font);
  const width =
    getVisibleWidth(examLines) + font.gap.length + getVisibleWidth(cookerLines);

  return {
    ...font,
    examLines,
    cookerLines,
    width,
  };
}

function pickBannerFont() {
  const columns = process.stdout.columns ?? 120;

  for (const font of BANNER_FONTS) {
    const candidate = measureWordmark(font);
    if (candidate.width <= columns - 4) {
      return candidate;
    }
  }

  return measureWordmark(BANNER_FONTS.at(-1) ?? BANNER_FONTS[0]);
}

function buildLogoLines() {
  const candidate = pickBannerFont();
  const examLines = colorizeBlock(
    candidate.examLines,
    EXAM_TOP,
    EXAM_BOTTOM,
    "vertical",
  );
  const cookerLines = colorizeBlock(
    candidate.cookerLines,
    COOKER_START,
    COOKER_END,
    "diagonal",
  );

  return examLines.map((line, index) => {
    return `${line}${candidate.gap}${cookerLines[index] ?? ""}`;
  });
}

function printBannerCommands() {
  const commandWidth = Math.max(
    ...BANNER_COMMANDS.map((command) => command.command.length),
  );

  for (const entry of BANNER_COMMANDS) {
    console.log(
      `  ${pc.dim("$")} ${pc.white(entry.command.padEnd(commandWidth))}  ${pc.dim(entry.description)}`,
    );
  }
}

export function showBanner() {
  console.log();
  buildLogoLines().forEach((line) => {
    console.log(line);
  });
  console.log();
  console.log(pc.dim("Study faster from the terminal."));
  console.log();
  printBannerCommands();
  console.log();
}

export function showHelp() {
  console.log(`
${pc.bold("Usage:")} examcooker [command] [options]

${pc.bold("Auth:")}
  auth login                Start browser-based CLI login
  auth logout               Revoke the current CLI token and clear local auth
  whoami                    Show the currently authenticated ExamCooker account

${pc.bold("Courses:")}
  courses search [query]    Search and pick ExamCooker courses

${pc.bold("Papers:")}
  papers search [query]      Guided course -> exam type -> paper flow
  papers view [paper]        Inspect a paper or pick one interactively
  papers download [paper]    Save a paper PDF to disk
  papers upload <file>       Upload a past paper PDF

${pc.bold("Common options:")}
  --base-url <url>          Point the CLI at a different ExamCooker deployment
  --json                    Print machine-readable JSON
  --no-interactive          Skip prompts and print plain output
  -h, --help                Show help
  -v, --version             Show version

${pc.bold("Examples:")}
  ${pc.dim("$")} examcooker
  ${pc.dim("$")} examcooker auth login
  ${pc.dim("$")} examcooker courses search distributed systems
  ${pc.dim("$")} examcooker papers search complex
  ${pc.dim("$")} examcooker papers view https://examcooker.acmvit.in/past_papers/BCSE409L/paper/cmoeqw7jz032ra8v3t92qszr9
  ${pc.dim("$")} examcooker papers upload ./fat.pdf
`);
}

export function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

export function truncate(value: string, width: number) {
  if (value.length <= width) {
    return value;
  }

  if (width <= 1) {
    return value.slice(0, width);
  }

  return `${value.slice(0, width - 1)}…`;
}

export function printTable(
  rows: Array<Record<string, string>>,
  columns: Array<{ key: string; label: string; width?: number }>,
) {
  if (rows.length === 0) {
    console.log(pc.dim("No results."));
    return;
  }

  const computedWidths = columns.map((column) => {
    const rowWidth = Math.max(
      ...rows.map((row) => row[column.key]?.length ?? 0),
      column.label.length,
    );
    return column.width ? Math.min(column.width, rowWidth) : rowWidth;
  });

  const header = columns
    .map((column, index) =>
      pc.bold(
        truncate(column.label, computedWidths[index]).padEnd(computedWidths[index]),
      ),
    )
    .join("  ");

  console.log(header);
  console.log(
    columns
      .map((_, index) => pc.dim("─".repeat(computedWidths[index])))
      .join("  "),
  );

  for (const row of rows) {
    const line = columns
      .map((column, index) =>
        truncate(row[column.key] ?? "", computedWidths[index]).padEnd(
          computedWidths[index],
        ),
      )
      .join("  ");
    console.log(line);
  }
}
