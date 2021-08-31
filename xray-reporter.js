const fs = require('fs');

const getDate = () => {
    const date = new Date();
    const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
    let tz = (utc - date.getTime()) / (60 * 60 * 1000);

    switch (true) {
        case (tz === 0):
            tz = '+00:00';
            break;
        case (tz < 9 && tz > 0):
            tz = '+0' + tz + ':00';
            break;
        case (tz > -9 && tz < 0):
            tz = '-0' + Math.abs(tz) + ':00';
            break;
        case (tz > 9):
            tz = '+' + tz + ':00';
            break;
        default:
            tz = tz + ':00';
            break;
    }

    return date.toISOString().split('.')[0] + tz;
};

// TODO: refactor this logic, can be heavily simplified
const XrayReporter = (options, onPrepareDefer, onCompleteDefer, browser) => {
    if (!options.hasOwnProperty('jiraClientId') || !options.hasOwnProperty('xrayAuthUrl')
        || !options.hasOwnProperty('jiraClientSecret') || !options.hasOwnProperty('xrayImportUrl')
        || !options.hasOwnProperty('jiraProjectKey')) {
        throw new Error('required options are missing');
    }

    const buildImageName = (specId) => {
        let imageName = './';
        imageName += browser.params.imageComparison.diffFolder;
        imageName += '/';
        imageName += specId;
        imageName += '-';
        imageName += browser.params.imageComparison.browserName;
        imageName += '-';
        imageName += browser.params.imageComparison.browserWidth;
        imageName += 'x';
        imageName += browser.params.imageComparison.browserHeight;
        imageName += '-dpr-';
        imageName += browser.params.imageComparison.devicePixelRatio;
        imageName += '.png';
        return imageName;
    };

    const XrayService = require('./xray-service')(options);

    const { description, version, jiraProjectKey: project } = options;
    const result = {
        info: {
            description,
            version,
            project
        },
        tests: []
    };

    browser.getProcessedConfig().then((config) => {
        result.info.summary = config.capabilities.name || 'no name';
        if (onPrepareDefer.resolve) {
            onPrepareDefer.resolve();
        } else {
            onPrepareDefer.fulfill();
        }
    });

    const specPromises = [];
    const specPromisesResolve = {};

    this.suiteStarted = (suite) => {
        result.tests.push({
            testKey: suite.description.split('@')[1],
            start: getDate(),
            steps: []
        });
    };

    this.specStarted = (spec) => {
        specPromises.push(new Promise((resolve) => {
            specPromisesResolve[spec.id] = resolve;
        }));
    };

    this.specDone = (spec) => {
        const testKey = spec.fullName.split('@')['1'].split(' ')[0];
        let index;
        result.tests.forEach((test, i) => {
            if (test.testKey === testKey) {
                index = i;
            }
        });

        if (spec.status === 'disabled') {
            result.tests[index].steps.push({
                status: 'TODO',
                id: spec.id
            });
            specPromisesResolve[spec.id]();
        } else {

            let specResult;

            if (spec.status !== 'passed') {
                result.tests[index].status = 'FAILED';
                let comment = '';
                for (let expectation of spec.failedExpectations) {
                    comment += expectation.message;
                }
                specResult = {
                    status: 'FAILED',
                    comment,
                    evidence: [],
                    id: spec.id
                };
            } else {
                result.tests[index].status !== 'FAILED' ? result.tests[index].status = 'PASSED' : 'FAILED';
                specResult = {
                    status: 'PASSED',
                    evidence: [],
                    id: spec.id
                };
            }

            if ((specResult.status === 'FAILED' && options.screenshot !== 'never') || options.screenshot === 'always') {
                const specDonePromises = [];

                specDonePromises.push(new Promise((resolve) => {
                    browser.takeScreenshot().then((png) => {
                        specResult.evidence.push({
                            data: png,
                            filename: 'screenshot.png',
                            contentType: 'image/png'
                        });
                        resolve();
                    });
                }));

                const specId = spec.description.split('@')[1];
                if (browser.params.imageComparison && specId && fs.existsSync(buildImageName(specId))) {
                    specDonePromises.push(new Promise((resolve) => {
                        fs.readFile(buildImageName(specId), (error, png) => {
                            if (error) {
                                throw new Error(error);
                            }

                            specResult.evidence.push({
                                data: new Buffer(png).toString('base64'),
                                filename: 'diff.png',
                                contentType: 'image/png'
                            });
                            resolve();
                        });
                    }));
                }

                Promise.all(specDonePromises)
                    .then(() => {
                        result.tests[index].steps.push(specResult);
                        specPromisesResolve[spec.id]();
                    });
            } else {
                result.tests[index].steps.push(specResult);
                specPromisesResolve[spec.id]();
            }
        }
    };

    this.suiteDone = (suite) => {
        const testKey = suite.description.split('@')[1];
        for (let test of result.tests) {
            if (test.testKey === testKey) {
                test.finish = getDate();
                break;
            }
        }
    };

    this.jasmineDone = () => {
        Promise.all(specPromises).then(() => {
            result.tests = result.tests.filter((test) => {
                return !!test.status;
            });
            for (let test of result.tests) {
                test.steps
                    .sort((a, b) => {
                        return parseInt(a.id.replace('spec', '')) - parseInt(b.id.replace('spec', ''));
                    })
                    .forEach((step) => {
                        delete step.id;
                    });
            }
            XrayService.authenticate((token) => {
                XrayService.createExecution({ result, token }, () => {
                    if (onCompleteDefer.resolve) {
                        onCompleteDefer.resolve();
                    } else {
                        onCompleteDefer.fulfill();
                    }
                });
            });
        });
    };

    return this;
};

module.exports = XrayReporter;

