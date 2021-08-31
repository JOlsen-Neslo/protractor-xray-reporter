const popsicle = require('popsicle');

const XrayService = (options) => {

    this.authenticate = (callback) => {
        const { xrayAuthUrl, jiraClientId, jiraClientSecret } = options;
        const body = {
            client_id: jiraClientId,
            client_secret: jiraClientSecret
        };

        popsicle.request({
            method: 'POST',
            url: xrayAuthUrl,
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then((response) => {
                if (response.status !== 200) {
                    throw new Error(`Authentication Error: ${response.body}`);
                }

                console.info('X-Ray client successfully authenticated.');
                callback(JSON.parse(response.body));
            })
            .catch((error) => {
                throw new Error(error);
            });
    };

    this.createExecution = (execution, callback) => {
        const { result: body, token } = execution;
        popsicle.request({
            method: 'POST',
            url: options.xrayImportUrl,
            body,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ token }`
            }
        })
            .then((res) => {
                if (res.status !== 200) {
                    throw new Error(`Import Error: ${res.body}`);
                }

                console.info('Pushed test execution to X-Ray');
                callback();
            })
            .catch((error) => {
                throw new Error(error);
            });
    };

    return this;
};

module.exports = XrayService;

