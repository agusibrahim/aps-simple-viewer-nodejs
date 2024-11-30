const express = require('express');
const formidable = require('express-formidable');
const { listObjects, uploadObject, translateObject, getManifest, urnify,getFileUrlByUrn,uploadObjectFromBase64,getThumbnailByUrn } = require('../services/aps.js');

let router = express.Router();

router.get('/api/models', async function (req, res, next) {
    try {
        const objects = await listObjects();
        res.json(objects.map(o => ({
            name: o.objectKey,
            urn: urnify(o.objectId)
        })));
    } catch (err) {
        next(err);
    }
});

router.get('/api/models/:urn/status', async function (req, res, next) {
    try {
        const manifest = await getManifest(req.params.urn);
        if (manifest) {
            let messages = [];
            if (manifest.derivatives) {
                for (const derivative of manifest.derivatives) {
                    messages = messages.concat(derivative.messages || []);
                    if (derivative.children) {
                        for (const child of derivative.children) {
                            messages.concat(child.messages || []);
                        }
                    }
                }
            }
            res.json({ status: manifest.status, progress: manifest.progress, messages });
        } else {
            res.json({ status: 'n/a' });
        }
    } catch (err) {
        next(err);
    }
});

router.post('/api/models', formidable({ maxFileSize: Infinity }), async function (req, res, next) {
    const file = req.files['model-file'];
    if (!file) {
        res.status(400).send('The required field ("model-file") is missing.');
        return;
    }
    try {
        const obj = await uploadObject(file.name, file.path);
        await translateObject(urnify(obj.objectId), req.fields['model-zip-entrypoint']);
        res.json({
            name: obj.objectKey,
            urn: urnify(obj.objectId)
        });
    } catch (err) {
        next(err);
    }
});
router.post('/api/models/upload-base64', async function (req, res, next) {
    const { objectName, base64Data } = req.body;

    if (!objectName || !base64Data) {
        return res.status(400).json({
            error: 'The fields "objectName" and "base64Data" are required.',
        });
    }

    try {
        const result = await uploadObjectFromBase64(objectName, base64Data);
        res.status(200).json({
            message: 'File uploaded successfully.',
            objectKey: result.objectKey,
            urn: urnify(result.objectId),
            size: result.size,
            location: result.location,
        });
    } catch (err) {
        console.error('Error uploading file:', err.message);
        next(err);
    }
});
router.get('/api/models/:urn/detail', async function (req, res, next) {
    try {
        const urn = req.params.urn;
        const url = await getFileUrlByUrn(urn); // Call the APS service function
        res.json({ url }); // Return the signed URL in the response
    } catch (err) {
        console.error('Error generating download URL:', err.message);
        next(err);
    }
});
router.get('/api/models/:urn/thumbnail', async function (req, res, next) {
    try {
        const urn = req.params.urn;

        // Call the APS service function to get the thumbnail
        const thumbnail = await getThumbnailByUrn(urn);

        // Send the thumbnail buffer as an image response
        res.set('Content-Type', 'image/png');
        res.send(thumbnail);
    } catch (err) {
        console.error('Error fetching thumbnail:', err.message);

        // Handle specific errors
        if (err.message.includes('Thumbnail not found')) {
            return res.status(404).json({ error: 'Thumbnail not found for the given URN' });
        }

        next(err);
    }
});

module.exports = router;
