const fs = require('fs');
const content = fs.readFileSync('C:/Users/Baven/.gemini/antigravity/brain/13d36d24-84b6-4bf4-8cc6-f5a65133e12a/.system_generated/steps/4/content.md', 'utf8');

// The OpenCode state seems to store messages in $R arrays.
// Let's just search for role:"user" and try to find the next few hundred characters.
const userIndices = [];
let i = -1;
while ((i = content.indexOf('role:"user"', i + 1)) !== -1) {
    userIndices.push(i);
}

// Print the context around the last 3 user messages
const lastIndices = userIndices.slice(-3);
for (const index of lastIndices) {
    console.log("=== USER MESSAGE ===");
    console.log(content.substring(index, index + 500));
}
