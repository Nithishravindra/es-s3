const { Client } = require('@elastic/elasticsearch');
const request = require('request-promise-native');
const fs = require('fs');
const util = require('util');
const elasticUrl = 'http://localhost:9200';
const esclient = new Client({ node: elasticUrl });
const elasticIndex = 'quote';
const type = 'text';
const awsUtils = require('./awsUtils');

const checkConnection = () => {
    return new Promise(async (resolve) => {
        console.log('Checking connection to ElasticSearch...');
        let isConnected = false;

        while (!isConnected) {
            try {
                await esclient.cluster.health({});
                console.log(
                    'Successfully connected to ElasticSearch'
                );
                isConnected = true;

                // eslint-disable-next-line no-empty
            } catch (_) {}
        }
        resolve(true);
    });
};

const createIndex = async () => {
    const index = await esclient.indices.create({
        index: elasticIndex
    });
    console.log(index);
    if (index.acknowledged) {
        console.log(`Created index ${elasticIndex}`);
        return true;
    } else {
        console.log(`Failed to create index. ${index}`);
        return false;
    }
};

const createMapping = async () => {
    try {
        const schema = {
            title: {
                type: 'text',
                analyzer: 'standard'
            },
            body: {
                type: 'text'
            }
        };

        await esclient.indices.putMapping({
            index: elasticIndex,
            type,
            include_type_name: true,
            body: {
                properties: schema
            }
        });

        console.log('Quotes mapping created successfully');
    } catch (err) {
        console.error(
            'An error occurred while setting the quotes mapping:'
        );
        console.error(err);
    }
};

const syncFiles = async () => {
    let files = await awsUtils.listObjectsInBucket();
    console.log(files);

    for (let file of files) {
        const data = await awsUtils.readFileContentsFromS3(file);
        let [title, ...body] = data.toString().split('\n');
        let result = await index(file, title, body);
        console.log('Indexing result: ', result);
    }
};

async function index(fid, title, body) {
    let url = `http://localhost:9200/${elasticIndex}/_doc/` + fid;
    let payload = {
        url: url,
        body: {
            title: title,
            body: body.join('\n')
        },
        json: true
    };
    return request.put(payload);
}
module.exports = {
    checkConnection,
    createIndex,
    createMapping,
    syncFiles,
    esclient,
    elasticIndex
};
