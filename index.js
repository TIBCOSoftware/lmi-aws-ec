'use strict';

const zlib = require('zlib');
const uldp = require('./uldp');
const parseString = require('xml2js').parseString;
const moment = require('moment');

const uldpConfig = {
    host: process.env.ULDP_HOST,
    collectorDomain: process.env.ULDP_COLLECTOR_DOMAIN,
};

const LEVELS = {
    '1': 'Critical',
    '2': 'Error',
    '3': 'Warning',
    '4': 'Information',
    '5': 'Verbose',
};

const KEYWORDS = {
    '0x8010000000000000': 'audit failure',
    '0x8020000000000000': 'audit success',
};

const IP_ADDRESS_RE = /(?:(?:[1-9]?\d|1\d\d|25[0-5]|2[0-4]\d)\.){3}(?:[1-9]?\d|1\d\d|25[0-5]|2[0-4]\d)/;

const debug = process.env.DEBUG === 'true';
const debug_uldp = process.env.DEBUG_ULDP === 'true';
const defaultSrcIP = process.env.SOURCE_IP === undefined ? '0.0.0.0' :
        process.env.SOURCE_IP === 'auto' ? null : process.env.SOURCE_IP;

// entry point
exports.handler = async (event, context) => {
    if (debug) {
        console.log('Receive event: ' + JSON.stringify(event));
    }
    const uldpSender = new uldp(uldpConfig);
    if (debug_uldp) {
        uldpSender.debug = true;
    }
    let count = 0;

    const payload = new Buffer(event.awslogs.data, 'base64');
    await uldpSender.promiseConnect();
    const resultText = await unzip(payload);
    const result = JSON.parse(resultText.toString());
    const logStream = result.logStream;
    const logGroup = result.logGroup;
    const ipFromLogStream = logStream.match(IP_ADDRESS_RE);
    const srcIP = (process.env.SOURCE_IP === undefined) && ipFromLogStream ? ipFromLogStream[0] : defaultSrcIP;
    const promises = [];
    for (const event of result.logEvents) {
        promises.push(parseWindowsEvent(event));
    }
    await Promise.all(promises);
    console.log('Sent ' + count + ' messages');
    await uldpSender.promiseClose(count);

    async function parseWindowsEvent(event) {
        if (debug) {
            console.log(event);
        }
        const parsed = await parseXlm(event.message);
        const system = parsed.Event.System[0];
        const criticality = system.Level[0];
        const sourceName = system.Provider[0].$.Name;
        const snareEventCounter = '0'; // TODO
        const dateTimeRaw = moment(system.TimeCreated.SystemTime);
        const dateTime = dateTimeRaw.format('ddd MMM DD HH:mm:ss YYYY');
        const eventId = system.EventID;
        const userName = 'N/A';
        const sidType = 'N/A';
        const keywords = system.Keywords[0];
        const eventLogType = keywords in KEYWORDS ? KEYWORDS[keywords] :
            criticality in LEVELS ?  LEVELS[criticality] : keywords;
        const computerName = system.Computer[0];
        const categoryString = 'unknown';
        const dataString = '';
        const expendedString = parsed.Event.RenderingInfo[0].Message[0].replace(/\t/g, '   ').replace(/\n/g, ' ');
        const checksum = logGroup + '/' + logStream;
        const eventDate = new Date(dateTimeRaw);
        const snareMessage = 'MSWinEventLog\t'
            + criticality + '\t' + sourceName + '\t' + snareEventCounter + '\t'
            + dateTime + '\t' + eventId + '\t' + sourceName + '\t' + userName + '\t' + sidType + '\t' + eventLogType +
            '\t' + computerName + '\t' + categoryString + '\t' + dataString + '\t' + expendedString + '\t' + checksum;
        if (debug) {
            console.log(snareMessage);
        }
        uldpSender.sendMessage(uldp.createWinSnareMessage(eventDate, srcIP, snareMessage));
        count++;
    }

    function parseXlm(payload) {
        return new Promise((resolve, reject) => {
            parseString(payload, (err, result) => {
                if (err !== null) {
                    reject(err);
                }
                resolve(result);
            });
        });
    }

    function unzip(payload) {
        // event data is base64(gzip(json))
        return new Promise((resolve, reject) =>
            zlib.gunzip(payload, (error, result) => {
                if (error) {
                    reject(error);
                }
                resolve(result);
            })
        );
    }
};
