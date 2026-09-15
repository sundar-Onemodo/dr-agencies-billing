const fs = require('fs');
const path = require('path');

const imagePath = path.join(__dirname, '..', 'assets', 'images', 'billing_app.png');
const outputPath = path.join(__dirname, '..', 'assets', 'images', 'billingAppLogoBase64.ts');

const imageBuffer = fs.readFileSync(imagePath);
const base64Data = imageBuffer.toString('base64');

const tsContent = `// Auto-generated Base64 Data for billing_app.png icon
export const BILLING_APP_LOGO_RAW_BASE64 = "${base64Data}";

export const BILLING_APP_LOGO_BASE64 = "data:image/png;base64," + BILLING_APP_LOGO_RAW_BASE64;
`;

fs.writeFileSync(outputPath, tsContent, 'utf-8');
console.log('Successfully generated billingAppLogoBase64.ts. Output bytes:', fs.statSync(outputPath).size);
