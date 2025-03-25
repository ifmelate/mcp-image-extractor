const { extractImageFromFile } = require('./dist/image-utils'); async function test() { try { console.log('Testing with test_image.png...'); const result = await extractImageFromFile({ file_path: 'test_image.png', resize: true, max_width: 800, max_height: 800 }); console.log('Success! Metadata:'); console.log(result.content[0].text); console.log('Base64 length:', result.content[1].data.length); console.log('MIME type:', result.content[1].mimeType); } catch (error) { console.error('Error:', error); } } test();
