process.env.NODE_ENV = 'test';

const mongoose = require("mongoose"),
    User = require('../models/user'),
    chai = require('chai'),
    chaiHttp = require('chai-http'),
    server = require('../app'),
    should = chai.should();

chai.use(chaiHttp);

describe('CAMPAIGN', () => {
    // beforeEach((done) => { //Before each test we empty the database
    //     Advertiser.remove({}, (err) => { 
    //        done();         
    //     });     
    // });
    var AuthToken;

    describe('Getting all campaigns', () => {
        let token;
        it('Logged in', (done) => {
            let data = {
                email: "dilip@askpundit.com",
                password: "guru@KDE99"
            }
            chai.request(server)
                .post('/api/login').
            send(data)
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    res.body.should.have.property('data');
                    res.body.data.should.have.property('AuthToken');
                    // res.body.errors.pages.should.have.property('kind').eql('required');
                    token = res.body.data.AuthToken;
                    done();
                });
        });
        it('list all eligible campaigns', (done) => {
            chai.request(server)
                .post('/api/allCampaigns')
                .set('AuthToken', token)
                .set('limit', 4000)
                .end((err, res) => {
                    res.should.have.status('200');
                    res.body.should.be.a('object');
                    res.body.should.have.property('data');
                    res.body.data.should.be.a('array');
                    // yourArray.every(i => expect(i).to.have.all.keys('bar'))
                    res.body.data.map((v, i) => {
                        v.should.have.property('_id');
                        v.should.have.property('campaignName');
                        v.should.have.property('updatedAt');
                        v.should.have.property('createdAt');
                        v.should.have.property('place');
                        v.should.have.property('targetPoints');
                        v.should.have.property('targetDistance');
                        v.should.have.property('start');
                        v.should.have.property('end');
                        v.should.have.property('bundle');
                        v.should.have.property('duration');
                        v.should.have.property('drivers');
                        v.should.have.property('wrapPlaces');
                        v.should.have.property('about');
                        v.should.have.property('campaignImage');
                        v.should.have.property('campaignStatus');
                        v.should.have.property('__v');
                    })
                    done();
                })
        })
    });
    // describe('GET ALL CAMPAIGNS',() => {

    // })
})