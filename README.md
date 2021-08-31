[![npm version](https://badge.fury.io/js/protractor-xray-v2-reporter.svg)](https://badge.fury.io/js/protractor-xray-v2-reporter)

Generates [X-Ray for Jira](https://marketplace.atlassian.com/plugins/com.xpandit.plugins.xray/server/overview)
test executions for protractor tests using the X-Ray Cloud V2 REST API.

# How to use

* Install **protractor-xray-v2-reporter** with npm

```bash
npm install --save-dev protractor-xray-v2-reporter
```

* Install **protractor-xray-v2-reporter** with yarn

```bash
yarn add protractor-xray-v2-reporter
```

* Update your protractor.conf.js file

```javascript
const XrayReporter = require('protractor-xray-reporter');

// Jasmine does not support promises for reporters, but protractor does for
// onPrepare and onComplete. We can use that to make the reporter async as
// well. Generate two promises on onPrepare and add them as arguments to the
// reporter.
let onPrepareDefer;
let onCompleteDefer;

exports.config = {
    'specs': [
        'example_spec.js'
    ],
    'framework': 'jasmine2',
    'directConnect': true,
    'capabilities': {
        // the name is what the test set will be called. Default is 'no name'
        'name': 'Google Chrome',
        'browserName': 'chrome'
    },
    'onPrepare': function () {

        // first promise is to make sure we get the test set name before the tests start.
        onPrepareDefer = protractor.promise.defer();
        // second promise is to make sure everything is done before protractor
        // quits
        onCompleteDefer = protractor.promise.defer();

        const options = {
            'screenshot': 'fail',
            'version': '2.0',
            'jiraClientId': 'XXX',
            'jiraClientSecret': 'XXX',
            'xrayAuthUrl': 'https://{jira-server}.atlassian.net/api/v2/authenticate',
            'xrayImportUrl': 'https://{jira-server}.atlassian.net/api/v2/import/execution'
        };

        // add the reporter
        jasmine.getEnv().addReporter(XrayReporter(options, onPrepareDefer, onCompleteDefer, browser));

        // return the promises for onPrepare..
        return onPrepareDefer.promise;
    },
    'onComplete': function () {
        // ..and onComplete
        return onCompleteDefer.promise;
    }
};
```

# Options

* `screenshot`

protractor-xray-v2-reporter can attach screenshots to test executions. Default is `fail`

- `never`  Never attach screenshots
- `fail`   only attach screenshots if the test failed
- `always` always attach screenshots

protractor-xray-reporter can work with
[wswebcreation/protractor-image-comparison](https://github.com/wswebcreation/protractor-image-comparison). If you have
protractor-image-comparison configured, the comparison images will also be uploaded.

* `version`

You can attach a version to the execution. The version has to exist before it is used, currently this reporter does not
create versions.

* `jiraClientId` (required) - Client ID provided when creating an X-Ray API Token.
* `jiraClientSecret` (required) - Client Secret provided when creating an X-Ray API Token.
* `xrayAuthUrl` (required) - URL to authenticate your Client ID and Client Secret with JIRA + X-Ray
* `xrayImportUrl` (required) - URL to import your test executions

This is your Xray api url

# Test Setup

A test set is represented by a `describe` block. The test set ID has to be added at the end of the description with an @
symbol.

A test step is represented by an `it` block.

If you want to use image comparison, the tag has to be added to the name of the test step with an @ symbol. You can use
any tag you like, as long as it is unique and has no spaces.

```javascript
describe('test set description @ABC-1', function () {

    it('should do something', function () {
        expect(2).toEqual(2);
    });

    it('should do something else @123', function () {
        expect(3).toEqual(3);
        expect(browser.params.imageComparison.checkElement((element), '123')).toBeLessThan(3.5);
    });

});
```

# References

#### References to X-Ray Cloud REST API

- https://docs.getxray.app/display/XRAYCLOUD/Version+2
- https://docs.getxray.app/display/XRAYCLOUD/Global+Settings%3A+API+Keys

