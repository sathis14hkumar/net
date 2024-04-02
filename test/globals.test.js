const assert = require('assert'),
    fetch = require('node-fetch'),
    server = require('../app'),
    each = require('sync-each'),
    __ = require('../helpers/globalFunctions'); /*this is my global fn */

var functions = {};

functions['login'] = { /*object for login function */
    routeName: 'login',
    /*api route name (url)*/
    description: 'check login POST api with multiple cases',
    /*any description for function */
    cases: [{ /*Here we can enter all type of test cases in each object */
            name: 'Check for valid staffId and password',
            /*test case for  */
            request: { /*request params */
                staffId: "flexi-0001",
                password: "password"
            },
            expected: 201 /*expected status code from api with request params*/
        }, {
            name: 'Check for Invalid staffId and password',
            request: {
                staffId: "wrong staffId",
                password: "password"
            },
            expected: 300
        },
        {
            name: 'Check for valid params',
            request: {
                password: "password"
            },
            expected: 400
        }
    ]
}






for (let eachFunction in functions) {

    var routeName = functions[eachFunction].routeName,
        description = functions[eachFunction].description,
        cases = functions[eachFunction].cases;

    describe(description, async () => {

        each(cases, (eachCase, next) => {
            it(eachCase.name, async () => {
                var res = await fetch(`${__.serverBaseUrl()}${routeName}`, {
                    method: 'POST',
                    body: JSON.stringify(eachCase.request),
                    headers: {
                        'Content-Type': 'application/json'
                    },
                });
                var json = await res.json(),
                    resultData;

                if (json.error) {
                    resultData = json.error;
                } else if (json.message)
                    resultData = json.message;
                else
                    resultData = json.data;

                assert.equal(res.status, eachCase.expected, resultData);
            });
            next();
        });
    });
}