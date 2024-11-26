const express = require('express');
const formidable = require('express-formidable');
const { listObjectsInFolder, uploadObjectToFolder, urnify,getFileUrlByUrn } = require('../services/aps.js');

let router = express.Router();

// Endpoint to list objects in a specific folder
router.get('/api/files/:folderName', async function (req, res, next) {
    try {
        const folderName = req.params.folderName;
        const objects = await listObjectsInFolder(folderName);
        res.json(objects.map(o => ({
            name: o,
            urn: urnify(o) // Optional: URN-ify the object keys
        })));
    } catch (err) {
        next(err);
    }
});

// Endpoint to upload an object to a specific folder
router.post('/api/files/:folderName', formidable({ maxFileSize: Infinity }), async function (req, res, next) {
    const file = req.files['model-file'];
    if (!file) {
        res.status(400).send('The required field ("model-file") is missing.');
        return;
    }
    try {
        const folderName = req.params.folderName;
        const obj = await uploadObjectToFolder(folderName, file.name, file.path);
        res.json({
            name: obj.objectKey,
            urn: urnify(obj.objectId)
        });
    } catch (err) {
        next(err);
    }
});
router.get('/api/files/urn/:urn/detail', async function (req, res, next) {
  try {
      const urn = req.params.urn;
      const url = await getFileUrlByUrn(urn); // Call the APS service function
      res.json({ url }); // Return the signed URL in the response
  } catch (err) {
      console.error('Error generating download URL:', err.message);
      next(err);
  }
});
module.exports = router;