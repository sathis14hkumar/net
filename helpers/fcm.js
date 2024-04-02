const FCM = require('fcm-push');
const fs = require('fs');
const moment = require('moment');

const serverkey = process.env.FCM_SERVER_KEY;
const fcmm = new FCM(serverkey);

class Fcm {
  async logData(contentToAppend, lore) {
    const today = new Date();
    const dirPath = `./public/logs/`;
    const fileName = `${dirPath}${lore}_${today.getFullYear()}_${
      today.getMonth() + 1
    }_${today.getDate()}.log`;

    if (fs.existsSync(fileName)) {
      await fs.mkdirSync(dirPath, { recursive: true }); // file created
    }

    await fs.appendFileSync(fileName, contentToAppend);
  }

  async sendMessage(message, notificationData, staffDetailswithDeviceToken) {
    return fcmm
      .send(message)
      .then(async (result) => {
        const logText = {
          time: moment().format(),
          params: result,
          notificationData,
          message,
          staffDetailswithDeviceToken,
        };

        await this.logData(`\n\n${JSON.stringify(logText)}`, 'logger');
      })
      .catch(async (error) => {
        const logText = {
          time: moment().format(),
          message,
          params: error,
          notificationData,
          staffDetailswithDeviceToken,
        };

        await this.logData(`\n\n${JSON.stringify(logText)}`, 'error');
      });
  }

  async push(
    deviceTokens,
    notificationData,
    collapseKey,
    staffDetailswithDeviceToken,
  ) {
    try {
      const foregroundShow = {
        show_in_foreground: true,
      };
      const customNotification = {
        ...foregroundShow,
        ...notificationData,
      };
      const data = {
        custom_notification: customNotification,
      };
      let response = '';
      const deviceTokenSet = deviceTokens.reduce((prev, curr) => {
        if (curr) {
          prev.add(curr);
        }

        return prev;
      }, new Set());

      deviceTokens = Array.from(deviceTokenSet);
      const expiration = Date.now();

      if (deviceTokens.length >= 1000) {
        const chunk = (arr, c) =>
          arr.reduce((all, one, i) => {
            const ch = Math.floor(i / c);

            all[ch] = [].concat(all[ch] || [], one);
            return all;
          }, []);
        const chunkArray = chunk(deviceTokens, 900);

        for (const temparray of chunkArray) {
          const message = {
            collapse_key: collapseKey,
            data,
            notification: customNotification,
            registration_ids: temparray,
            apns: {
              headers: {
                'apns-expiration': `${expiration}`,
              },
            },
            android: {
              ttl: '60s',
            },
            time_to_live: 30,
          };

          /* eslint-disable no-await-in-loop */
          response = await this.sendMessage(
            message,
            notificationData,
            staffDetailswithDeviceToken,
          );
          /* eslint-enable no-await-in-loop */
        }
      } else {
        const message = {
          collapse_key: collapseKey,
          data,
          notification: customNotification,
          registration_ids: deviceTokens,
          apns: {
            headers: {
              'apns-expiration': `${expiration}`,
            },
          },
          android: {
            ttl: '60s',
          },
          time_to_live: 30,
        };

        response = await this.sendMessage(
          message,
          notificationData,
          staffDetailswithDeviceToken,
        );
      }

      return {
        data: 'Successfully sent with response: ',
        response,
      };
    } catch (err) {
      return {
        data: 'Something has gone wrong! ',
        response: err,
      };
    }
  }
}
const fcm = new Fcm();

module.exports = fcm;
