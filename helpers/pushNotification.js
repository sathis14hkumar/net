// import FCM from 'fcm-push';
const FCM = require('fcm-push');

const fcmKey = process.env.FCM_SERVER_KEY;
const fcm = new FCM(fcmKey);

class PushNotification {
  async push(notificationData, token, key) {
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
    const Apnsexpiration = Date.now();
    const message = {
      collapse_key: key,
      data,
      notification: customNotification,
      registration_ids: token,
      apns: {
        headers: {
          'apns-expiration': Apnsexpiration,
        },
      },
      android: {
        ttl: '60s',
      },
      time_to_live: 30,
    };

    fcm.send(message);
  }
}
const pushNotification = new PushNotification();

module.exports = pushNotification;
