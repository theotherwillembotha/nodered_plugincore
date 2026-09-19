/**
 * inline-resources.js
 *
 * Runs after tsc and before generate-nodes. Reads compiled JS resource files
 * and inlines them into their corresponding HTML templates, writing the result
 * to build/ so that generate-nodes picks up self-contained templates.
 *
 * This eliminates the need for a separate resources/ folder at runtime —
 * consumer plugins that bundle plugincore inline get the script automatically.
 *
 * Pattern: to inline a new resource, add an entry to the INLINES array below.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const INLINES = [
    {
        // Compiled JS to inline
        resource: 'build/resources/editorLanguageExtension.js',
        // Source HTML template (readable, with <script src="...">)
        sourceHtml: 'src/core/ui/template/ScriptEditorTemplate.html',
        // Output HTML (self-contained, with inlined <script>)
        outputHtml: 'build/core/ui/template/ScriptEditorTemplate.html',
        // Pattern to find and replace in the HTML
        pattern: /<script src="resources\/@theotherwillembotha\/node-red-plugincore\/editorLanguageExtension\.js"><\/script>/,
        // Replacement template — {{content}} is replaced with the file contents
        replacement: '<script type="text/javascript">\n{{content}}\n</script>',
    },
];

INLINES.forEach(({ resource, sourceHtml, outputHtml, pattern, replacement }) => {
    const resourcePath = path.resolve(ROOT, resource);
    const sourcePath = path.resolve(ROOT, sourceHtml);
    const outputPath = path.resolve(ROOT, outputHtml);

    if (!fs.existsSync(resourcePath)) {
        console.error(`inline-resources: missing ${resource} — was tsc run first?`);
        process.exit(1);
    }

    const jsContent = fs.readFileSync(resourcePath, 'utf-8');
    const html = fs.readFileSync(sourcePath, 'utf-8');
    const inlined = html.replace(pattern, replacement.replace('{{content}}', jsContent));

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, inlined);
    console.log(`inline-resources: ${resource} → ${outputHtml}`);
});
