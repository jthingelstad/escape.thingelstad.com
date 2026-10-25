// The shape the llmstxt.org reference parser (llms-txt, parse_llms_file) reads. It starts a section at
// every line that begins "##" (so "###" too) and reads every non-empty line under one as
// "- [name](url): note"; a line with no link stops the whole parse, and a second link on a line is
// lost. Prose belongs above the first "##", after "# Title" and the "> summary", with no headings.
const LINK_LINE = /^- \[[^\]]+\]\(https?:[^)\s]+\)(: \S.*)?$/;

function llmsShapeProblems(text) {
  const lines = String(text).split('\n');
  const problems = [];
  if (!/^# \S/.test(lines[0])) problems.push('line 1: not "# Title"');
  let inSection = false;
  lines.forEach((line, index) => {
    const where = `line ${index + 1}`;
    if (line.startsWith('##')) {
      inSection = true;
      return;
    }
    if (index === 0 || line.trim() === '') return;
    if (!inSection) {
      if (line.startsWith('#')) problems.push(`${where}: a heading above the first "##": ${line}`);
      return;
    }
    if (!LINK_LINE.test(line)) problems.push(`${where}: not "- [name](url): note": ${line}`);
    else if (line.split('](').length > 2) problems.push(`${where}: more than one link: ${line}`);
  });
  return problems;
}

module.exports = { llmsShapeProblems };
