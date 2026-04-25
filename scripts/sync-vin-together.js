#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const SITE_ORIGIN = "https://v-in-together.vercel.app";
const COURSES_URL = `${SITE_ORIGIN}/courses`;
const OUTPUT_PATH = path.join(
    __dirname,
    "..",
    "lib",
    "generated",
    "vinTogether.json",
);

function propertyNameText(name) {
    if (!name) return null;
    if (
        ts.isIdentifier(name) ||
        ts.isStringLiteral(name) ||
        ts.isNumericLiteral(name)
    ) {
        return String(name.text);
    }
    return null;
}

function ensureArray(value) {
    return Array.isArray(value) ? value : [];
}

function slugify(value) {
    return value
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function absoluteUrl(value) {
    if (!value || typeof value !== "string") return null;
    if (/^https?:\/\//i.test(value)) return value;
    const trimmed = value.startsWith("/") ? value : `/${value}`;
    return `${SITE_ORIGIN}${trimmed}`;
}

function normalizeRichItems(items) {
    return ensureArray(items)
        .map((item) => {
            if (typeof item === "string") {
                return { text: item.trim() };
            }

            if (!item || typeof item !== "object") {
                return null;
            }

            const text =
                typeof item.text === "string" ? item.text.trim() : undefined;
            const image =
                typeof item.image === "string"
                    ? absoluteUrl(item.image)
                    : undefined;

            if (!text && !image) return null;

            return {
                ...(text ? { text } : {}),
                ...(image ? { image } : {}),
            };
        })
        .filter(Boolean);
}

function normalizeVideos(videos) {
    return ensureArray(videos)
        .filter((video) => typeof video === "string" && video.trim())
        .map((video) => video.trim());
}

function extractJsxText(node) {
    if (!node) return "";

    if (ts.isJsxText(node)) {
        return node.getText().replace(/\s+/g, " ").trim();
    }

    if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node)
    ) {
        return node.text.trim();
    }

    if (ts.isParenthesizedExpression(node)) {
        return extractJsxText(node.expression);
    }

    if (ts.isJsxExpression(node)) {
        return extractJsxText(node.expression);
    }

    if (ts.isJsxFragment(node)) {
        return node.children
            .map((child) => extractJsxText(child))
            .filter(Boolean)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
    }

    if (ts.isJsxElement(node)) {
        const tagName = node.openingElement.tagName.getText();
        const textContent = node.children
            .map((child) => extractJsxText(child))
            .filter(Boolean)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();

        if (tagName === "a") {
            const hrefAttribute = node.openingElement.attributes.properties.find(
                (attribute) =>
                    ts.isJsxAttribute(attribute) &&
                    attribute.name.text === "href" &&
                    attribute.initializer &&
                    ts.isStringLiteral(attribute.initializer),
            );
            const href =
                hrefAttribute &&
                ts.isJsxAttribute(hrefAttribute) &&
                hrefAttribute.initializer &&
                ts.isStringLiteral(hrefAttribute.initializer)
                    ? hrefAttribute.initializer.text
                    : "";

            return [textContent, href ? `(${href})` : ""]
                .filter(Boolean)
                .join(" ")
                .trim();
        }

        return textContent;
    }

    if (ts.isJsxSelfClosingElement(node)) {
        return "";
    }

    return "";
}

function evaluateLiteral(node) {
    if (!node) return undefined;

    if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node)
    ) {
        return node.text;
    }

    if (ts.isNumericLiteral(node)) {
        return Number(node.text);
    }

    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;

    if (ts.isArrayLiteralExpression(node)) {
        return node.elements.map((element) => evaluateLiteral(element));
    }

    if (ts.isParenthesizedExpression(node)) {
        return evaluateLiteral(node.expression);
    }

    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
        return extractJsxText(node);
    }

    if (ts.isObjectLiteralExpression(node)) {
        const objectValue = {};

        for (const property of node.properties) {
            if (!ts.isPropertyAssignment(property)) continue;
            const key = propertyNameText(property.name);
            if (!key) continue;
            objectValue[key] = evaluateLiteral(property.initializer);
        }

        return objectValue;
    }

    if (ts.isJsxExpression(node)) {
        return evaluateLiteral(node.expression);
    }

    throw new Error(`Unsupported literal node: ${ts.SyntaxKind[node.kind]}`);
}

function createSourceFile(name, content) {
    return ts.createSourceFile(
        name,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.JSX,
    );
}

function findVariableInitializer(sourceFile, variableName) {
    let initializer = null;

    function visit(node) {
        if (
            ts.isVariableDeclaration(node) &&
            ts.isIdentifier(node.name) &&
            node.name.text === variableName
        ) {
            initializer = node.initializer ?? null;
            return;
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    return initializer;
}

function getJsxAttributeValue(attribute) {
    if (!attribute.initializer) return true;

    if (ts.isStringLiteral(attribute.initializer)) {
        return attribute.initializer.text;
    }

    if (ts.isJsxExpression(attribute.initializer)) {
        return evaluateLiteral(attribute.initializer.expression);
    }

    throw new Error(
        `Unsupported JSX attribute initializer: ${ts.SyntaxKind[attribute.initializer.kind]}`,
    );
}

function extractCourses(sourceMap) {
    const coursesSourceIndex = sourceMap.sources.findIndex(
        (sourceName) => sourceName === "CoursesPage.js",
    );

    if (coursesSourceIndex < 0) {
        throw new Error("Could not find CoursesPage.js in the VInTogether source map.");
    }

    const sourceFile = createSourceFile(
        "CoursesPage.js",
        sourceMap.sourcesContent[coursesSourceIndex],
    );
    const initializer = findVariableInitializer(sourceFile, "allCourses");

    if (!initializer) {
        throw new Error("Could not find allCourses in CoursesPage.js.");
    }

    return ensureArray(evaluateLiteral(initializer));
}

function buildImportMap(appSourceFile, sourceNames) {
    function resolveImportSpecifier(specifier) {
        const normalized = specifier.replace(/^\.\//, "");
        const candidates = [
            normalized,
            `${normalized}.js`,
            `${normalized}/index.js`,
        ];

        for (const candidate of candidates) {
            if (sourceNames.has(candidate)) return candidate;
        }

        return null;
    }

    const importMap = new Map();

    for (const statement of appSourceFile.statements) {
        if (!ts.isImportDeclaration(statement) || !statement.importClause) {
            continue;
        }

        if (!ts.isStringLiteral(statement.moduleSpecifier)) {
            continue;
        }

        const resolvedSource = resolveImportSpecifier(
            statement.moduleSpecifier.text,
        );
        const clause = statement.importClause;

        if (clause.name) {
            importMap.set(clause.name.text, resolvedSource);
        }

        if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
            for (const element of clause.namedBindings.elements) {
                importMap.set(element.name.text, resolvedSource);
            }
        }
    }

    return importMap;
}

function extractRoutes(sourceMap) {
    const appSourceIndex = sourceMap.sources.findIndex(
        (sourceName) => sourceName === "App.js",
    );

    if (appSourceIndex < 0) {
        throw new Error("Could not find App.js in the VInTogether source map.");
    }

    const sourceNames = new Set(sourceMap.sources);
    const appSourceFile = createSourceFile(
        "App.js",
        sourceMap.sourcesContent[appSourceIndex],
    );
    const importMap = buildImportMap(appSourceFile, sourceNames);
    const routes = new Map();

    function visit(node) {
        if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(appSourceFile) === "Route") {
            let routePath = null;
            let elementName = null;

            for (const attribute of node.attributes.properties) {
                if (!ts.isJsxAttribute(attribute)) continue;
                const attributeName = attribute.name.text;

                if (
                    attributeName === "path" &&
                    attribute.initializer &&
                    ts.isStringLiteral(attribute.initializer)
                ) {
                    routePath = attribute.initializer.text;
                }

                if (
                    attributeName === "element" &&
                    attribute.initializer &&
                    ts.isJsxExpression(attribute.initializer) &&
                    attribute.initializer.expression
                ) {
                    const expression = attribute.initializer.expression;

                    if (ts.isJsxSelfClosingElement(expression)) {
                        elementName = expression.tagName.getText(appSourceFile);
                    } else if (ts.isJsxElement(expression)) {
                        elementName = expression.openingElement.tagName.getText(appSourceFile);
                    }
                }
            }

            if (routePath && elementName && importMap.has(elementName)) {
                routes.set(routePath, importMap.get(elementName));
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(appSourceFile);

    return routes;
}

function extractModuleMap(sourceContent) {
    const sourceFile = createSourceFile("module.js", sourceContent);
    const initializer = findVariableInitializer(sourceFile, "subtopicsData");

    if (!initializer) {
        throw new Error("Could not find subtopicsData.");
    }

    return evaluateLiteral(initializer);
}

function extractSubtopicContent(sourceName, sourceContent) {
    const sourceFile = createSourceFile(sourceName, sourceContent);
    const supportedComponents = new Set(["QPhototModuleSubtopic"]);
    let extracted = null;

    function visit(node) {
        if (extracted) return;

        if (ts.isJsxSelfClosingElement(node)) {
            const componentName = node.tagName.getText(sourceFile);

            if (
                componentName.endsWith("ModuleSubtopic") ||
                supportedComponents.has(componentName)
            ) {
                extracted = {};

                for (const attribute of node.attributes.properties) {
                    if (!ts.isJsxAttribute(attribute)) continue;

                    const attributeName = attribute.name.text;

                    if (
                        ![
                            "title",
                            "videos",
                            "pdfLink",
                            "takeaways",
                            "questions",
                            "exampleVideos",
                        ].includes(attributeName)
                    ) {
                        continue;
                    }

                    extracted[attributeName] = getJsxAttributeValue(attribute);
                }

                return;
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    if (!extracted) {
        throw new Error(`Could not extract subtopic payload from ${sourceName}.`);
    }

    const takeaways = normalizeRichItems(extracted.takeaways);
    const questions = normalizeRichItems(extracted.questions);
    const videos = normalizeVideos(extracted.videos);
    const exampleVideos = normalizeVideos(extracted.exampleVideos);
    const pdfLink =
        typeof extracted.pdfLink === "string"
            ? absoluteUrl(extracted.pdfLink)
            : null;

    return {
        title:
            typeof extracted.title === "string"
                ? extracted.title.trim()
                : "Untitled topic",
        videos,
        exampleVideos,
        pdfLink,
        takeaways,
        questions,
        counts: {
            videoCount: videos.length,
            exampleVideoCount: exampleVideos.length,
            takeawayCount: takeaways.length,
            questionCount: questions.length,
            assetCount:
                takeaways.filter((item) => item.image).length +
                questions.filter((item) => item.image).length +
                (pdfLink ? 1 : 0),
        },
    };
}

function findModuleSource(sourceMap, coursePath) {
    const moduleKey = `${coursePath.replace(/^\/subject-/, "").replace(/\/$/, "")}.js`;
    return (
        sourceMap.sources.find(
            (sourceName) => sourceName.toLowerCase() === moduleKey.toLowerCase(),
        ) ?? null
    );
}

function buildCourseCatalog(sourceMap, courses, routeMap) {
    const sourceContentByName = new Map(
        sourceMap.sources.map((sourceName, index) => [
            sourceName,
            sourceMap.sourcesContent[index],
        ]),
    );

    return courses.map((course, courseIndex) => {
        const moduleSourceName = findModuleSource(sourceMap, course.path);
        const moduleMap = moduleSourceName
            ? extractModuleMap(sourceContentByName.get(moduleSourceName))
            : {};

        const modules = Object.entries(moduleMap).map(
            ([moduleTitle, subtopics], moduleIndex) => {
                const normalizedSubtopics = ensureArray(subtopics).map(
                    (subtopic, topicIndex) => {
                        const sourceName = routeMap.get(subtopic.path) ?? null;
                        const detail = sourceName
                            ? extractSubtopicContent(
                                  sourceName,
                                  sourceContentByName.get(sourceName),
                              )
                            : null;

                        return {
                            id: subtopic.path.replace(/^\//, ""),
                            slug: subtopic.path.replace(/^\//, ""),
                            remotePath: subtopic.path,
                            name:
                                typeof subtopic.name === "string"
                                    ? subtopic.name.trim()
                                    : "Untitled topic",
                            title: detail?.title ?? subtopic.name ?? "Untitled topic",
                            videos: detail?.videos ?? [],
                            exampleVideos: detail?.exampleVideos ?? [],
                            pdfLink: detail?.pdfLink ?? null,
                            takeaways: detail?.takeaways ?? [],
                            questions: detail?.questions ?? [],
                            counts: detail?.counts ?? {
                                videoCount: 0,
                                exampleVideoCount: 0,
                                takeawayCount: 0,
                                questionCount: 0,
                                assetCount: 0,
                            },
                            sourceFile: sourceName,
                            order: topicIndex,
                        };
                    },
                );

                const moduleCounts = normalizedSubtopics.reduce(
                    (totals, topic) => {
                        totals.topicCount += 1;
                        totals.videoCount += topic.counts.videoCount;
                        totals.exampleVideoCount += topic.counts.exampleVideoCount;
                        totals.takeawayCount += topic.counts.takeawayCount;
                        totals.questionCount += topic.counts.questionCount;
                        totals.assetCount += topic.counts.assetCount;
                        if (topic.pdfLink) totals.resourceCount += 1;
                        return totals;
                    },
                    {
                        topicCount: 0,
                        videoCount: 0,
                        exampleVideoCount: 0,
                        takeawayCount: 0,
                        questionCount: 0,
                        assetCount: 0,
                        resourceCount: 0,
                    },
                );

                return {
                    id: `${slugify(course.name)}-module-${moduleIndex + 1}`,
                    slug: slugify(moduleTitle),
                    title: moduleTitle,
                    order: moduleIndex,
                    counts: moduleCounts,
                    subtopics: normalizedSubtopics,
                };
            },
        );

        const courseCounts = modules.reduce(
            (totals, module) => {
                totals.moduleCount += 1;
                totals.topicCount += module.counts.topicCount;
                totals.videoCount += module.counts.videoCount;
                totals.exampleVideoCount += module.counts.exampleVideoCount;
                totals.takeawayCount += module.counts.takeawayCount;
                totals.questionCount += module.counts.questionCount;
                totals.assetCount += module.counts.assetCount;
                totals.resourceCount += module.counts.resourceCount;
                return totals;
            },
            {
                moduleCount: 0,
                topicCount: 0,
                videoCount: 0,
                exampleVideoCount: 0,
                takeawayCount: 0,
                questionCount: 0,
                assetCount: 0,
                resourceCount: 0,
            },
        );

        return {
            id: slugify(course.name),
            slug: slugify(course.name),
            name: course.name,
            year: course.year,
            image: absoluteUrl(course.image),
            remotePath: course.path,
            sourceModulesPath: moduleSourceName,
            counts: courseCounts,
            order: courseIndex,
            modules,
        };
    });
}

async function fetchText(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`);
    }

    return response.text();
}

async function fetchJson(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

async function syncVinTogether() {
    const coursesHtml = await fetchText(COURSES_URL);
    const bundleMatch = coursesHtml.match(
        /<script[^>]+src="([^"]*\/static\/js\/main\.[^"]+\.js)"/i,
    );

    if (!bundleMatch) {
        throw new Error("Could not locate the main VInTogether bundle on /courses.");
    }

    const bundleUrl = new URL(bundleMatch[1], SITE_ORIGIN).toString();
    const bundleContent = await fetchText(bundleUrl);
    const sourceMapMatch = bundleContent.match(
        /\/\/# sourceMappingURL=([^\s]+)/,
    );
    const sourceMapUrl = sourceMapMatch
        ? new URL(sourceMapMatch[1], bundleUrl).toString()
        : `${bundleUrl}.map`;
    const sourceMap = await fetchJson(sourceMapUrl);
    const courses = extractCourses(sourceMap);
    const routeMap = extractRoutes(sourceMap);
    const catalog = buildCourseCatalog(sourceMap, courses, routeMap);

    return {
        syncedAt: new Date().toISOString(),
        source: {
            origin: SITE_ORIGIN,
            coursesUrl: COURSES_URL,
            bundleUrl,
            sourceMapUrl,
        },
        counts: {
            courseCount: catalog.length,
            moduleCount: catalog.reduce(
                (total, course) => total + course.counts.moduleCount,
                0,
            ),
            topicCount: catalog.reduce(
                (total, course) => total + course.counts.topicCount,
                0,
            ),
            videoCount: catalog.reduce(
                (total, course) =>
                    total +
                    course.counts.videoCount +
                    course.counts.exampleVideoCount,
                0,
            ),
            questionCount: catalog.reduce(
                (total, course) => total + course.counts.questionCount,
                0,
            ),
        },
        courses: catalog,
    };
}

async function main() {
    try {
        const catalog = await syncVinTogether();
        fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
        fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
        console.log(
            `[sync-vin-together] Synced ${catalog.counts.courseCount} courses, ${catalog.counts.topicCount} topics.`,
        );
        console.log(`[sync-vin-together] Wrote ${OUTPUT_PATH}`);
    } catch (error) {
        if (fs.existsSync(OUTPUT_PATH)) {
            console.warn(
                `[sync-vin-together] ${error.message}. Using the existing ${OUTPUT_PATH} snapshot.`,
            );
            return;
        }

        console.error("[sync-vin-together] Failed to sync VInTogether data.");
        console.error(error);
        process.exit(1);
    }
}

main();
