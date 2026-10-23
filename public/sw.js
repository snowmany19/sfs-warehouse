// No employee data or authenticated responses are stored in an offline cache.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',()=>{});
self.addEventListener('push',event=>{
 event.waitUntil(self.registration.showNotification('SFS Warehouse',{
  body:'Your assignment has changed. Open the app to review it.',icon:'/icons/app-192.png',badge:'/icons/app-192.png',tag:'sfs-assignment',renotify:true,data:{url:'/my-assignment'},
 }));
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});const existing=windows.find(w=>new URL(w.url).origin===self.location.origin);if(existing){await existing.navigate('/my-assignment');await existing.focus();}else await self.clients.openWindow('/my-assignment');})());});
