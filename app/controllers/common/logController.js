const fs = require('fs');

class ErrorLog {
  async setLog(req, res) {
    await fs.appendFileSync(
      './public/tmp/mobileResponse.log',
      JSON.stringify(req.body.error),
    );
    return res.json(201, 'Successfully updated');
  }
}
const logController = new ErrorLog();

module.exports = logController;
