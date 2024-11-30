const { AuthenticationClient, Scopes } = require('@aps_sdk/authentication');
const { OssClient, Region, PolicyKey } = require('@aps_sdk/oss');
const { ModelDerivativeClient, View, OutputType } = require('@aps_sdk/model-derivative');
const { APS_CLIENT_ID, APS_CLIENT_SECRET, APS_BUCKET } = require('../config.js');

const authenticationClient = new AuthenticationClient();
const ossClient = new OssClient();
const modelDerivativeClient = new ModelDerivativeClient();

const service = module.exports = {};

async function getInternalToken() {
    const credentials = await authenticationClient.getTwoLeggedToken(APS_CLIENT_ID, APS_CLIENT_SECRET, [
        Scopes.DataRead,
        Scopes.DataCreate,
        Scopes.DataWrite,
        Scopes.BucketCreate,
        Scopes.BucketRead
    ]);
    return credentials.access_token;
}

service.getViewerToken = async () => {
    return await authenticationClient.getTwoLeggedToken(APS_CLIENT_ID, APS_CLIENT_SECRET, [Scopes.ViewablesRead]);
};
service.getFullAccessToken = async () => {
    return await authenticationClient.getTwoLeggedToken(APS_CLIENT_ID, APS_CLIENT_SECRET, [
        Scopes.DataRead,
        Scopes.DataCreate,
        Scopes.DataWrite,
        Scopes.BucketCreate,
        Scopes.BucketRead
    ]);
};

service.ensureBucketExists = async (bucketKey) => {
    const accessToken = await getInternalToken();
    try {
        await ossClient.getBucketDetails(bucketKey, { accessToken });
    } catch (err) {
        if (err.axiosError.response.status === 404) {
            await ossClient.createBucket(Region.Us, { bucketKey: bucketKey, policyKey: PolicyKey.Persistent }, { accessToken});
        } else {
            throw err;  
        }
    }
};

service.listObjects = async () => {
    await service.ensureBucketExists(APS_BUCKET);
    const accessToken = await getInternalToken();
    let resp = await ossClient.getObjects(APS_BUCKET, { limit: 64, accessToken });
    let objects = resp.items;
    while (resp.next) {
        const startAt = new URL(resp.next).searchParams.get('startAt');
        resp = await ossClient.getObjects(APS_BUCKET, { limit: 64, startAt, accessToken });
        objects = objects.concat(resp.items);
    }
    return objects;
};

service.uploadObject = async (objectName, filePath) => {
    await service.ensureBucketExists(APS_BUCKET);
    const accessToken = await getInternalToken();
    const obj = await ossClient.upload(APS_BUCKET, objectName, filePath, { accessToken });
    return obj;
};
service.uploadObjectFromBase64 = async (objectName, base64Data) => {
    await service.ensureBucketExists(APS_BUCKET);
    const accessToken = await getInternalToken();

    // Decode Base64 to binary data
    const binaryData = Buffer.from(base64Data, 'base64');

    try {
        // Upload the binary data to the bucket
        const obj = await ossClient.upload(APS_BUCKET, objectName, binaryData, {
            accessToken,
            contentType: 'application/octet-stream' // You can set appropriate content type if known
        });
        return obj;
    } catch (err) {
        console.error('Error uploading object from Base64:', err.message);
        throw err;
    }
};

service.translateObject = async (urn, rootFilename) => {
    const accessToken = await getInternalToken();
    const job = await modelDerivativeClient.startJob({
        input: {
            urn,
            compressedUrn: !!rootFilename,
            rootFilename
        },
        output: {
            formats: [{
                views: [View._2d, View._3d],
                type: OutputType.Svf2
            }]
        }
    }, { accessToken });
    return job.result;
};

service.getManifest = async (urn) => {
    const accessToken = await getInternalToken();
    try {
        const manifest = await modelDerivativeClient.getManifest(urn, { accessToken });
        return manifest;
    } catch (err) {
        if (err.axiosError.response.status === 404) {
            return null;
        } else {
            throw err;
        }
    }
};
// modif
service.listObjectsInFolder = async (folderName) => {
    folderName=folderName.toLowerCase();
    await service.ensureBucketExists(folderName);
    const accessToken = await getInternalToken();
    let resp = await ossClient.getObjects(folderName, { limit: 64, accessToken });
    let objects = resp.items;
    while (resp.next) {
        const startAt = new URL(resp.next).searchParams.get('startAt');
        resp = await ossClient.getObjects(folderName, { limit: 64, startAt, accessToken });
        objects = objects.concat(resp.items);
    }
    return objects.map(obj => obj.objectKey); // Return list of object keys
};

service.uploadObjectToFolder = async (folderName, objectName, filePath) => {
    await service.ensureBucketExists(APS_BUCKET);
    const accessToken = await getInternalToken();
    const objectKey = `${folderName}/${objectName}`; // Add folder prefix to object name
    const obj = await ossClient.upload(APS_BUCKET, objectKey, filePath, { accessToken });
    return obj;
};
service.getFileUrlByUrn = async (urn) => {
    const accessToken = await getInternalToken();
    try {
        // Decode the URN to get the objectKey
        const decodedUrn = Buffer.from(urn, 'base64').toString('ascii');
        const bucketKey = APS_BUCKET; // Default bucket from configuration
        const objectKey = decodedUrn; // Assume decoded URN is the objectKey

        // Use OSS API to get object details, including signed URL
        const objectDetails = await ossClient.getObjectDetails(bucketKey, objectKey, { accessToken });

        // Extract the signed URL from the object details
        const signedUrl = objectDetails.signedUrl;

        return objectDetails;
    } catch (err) {
        console.error('Error generating signed URL for URN:', err.message);
        throw err;
    }
};
service.getThumbnailByUrn = async (urn) => {
    const accessToken = await getInternalToken();

    try {
        // Fetch the thumbnail using ModelDerivativeClient
        const response = await modelDerivativeClient.getThumbnail(urn, { accessToken,width:500,height:500 });
        console.log(`-->${response}<--`)
        // Return the thumbnail as a buffer
        return response; // Buffer of the thumbnail
    } catch (err) {
        console.error('Error fetching thumbnail:', err.message);
        if (err.axiosError && err.axiosError.response.status === 404) {
            throw new Error('Thumbnail not found for the given URN');
        }
        throw err;
    }
};

service.urnify = (id) => Buffer.from(id).toString('base64').replace(/=/g, '');