importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// These values should match your firebase-applet-config.json
firebase.initializeApp({
  projectId: "gen-lang-client-0655644548",
  appId: "1:127217883729:web:4a8680c751c8677ea33670",
  apiKey: "AIzaSyA2s2fbkD0k53iOtkw64dkz-FU-W5B7h8c",
  authDomain: "gen-lang-client-0655644548.firebaseapp.com",
  messagingSenderId: "127217883729"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/firebase-logo.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
