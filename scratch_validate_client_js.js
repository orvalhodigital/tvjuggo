const http = require('http');
const vm = require('vm');

http.get('http://localhost:3000', res => {
  let html = '';
  res.on('data', c => html += c);
  res.on('end', () => {
    // Extract script
    const scriptMatches = html.match(/<script[\s\S]*?<\/script>/gi);
    if (!scriptMatches) {
      console.log('No scripts found');
      return;
    }
    scriptMatches.forEach((s, idx) => {
      const code = s.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
      try {
        new vm.Script(code);
        console.log(`Script #${idx} compiled successfully!`);
      } catch (err) {
        console.error(`Script #${idx} error:`, err.message);
        console.error(err.stack);
        const lines = code.split('\n');
        // Let's print around the error if line number is available
        const lineMatch = err.stack.match(/evalmachine\.<anonymous>:(\d+)/);
        if (lineMatch) {
          const lNum = parseInt(lineMatch[1], 10);
          console.log(`Around line ${lNum}:`);
          for (let i = Math.max(0, lNum - 5); i < Math.min(lines.length, lNum + 5); i++) {
            console.log(`${i+1}: ${lines[i]}`);
          }
        }
      }
    });
  });
});
