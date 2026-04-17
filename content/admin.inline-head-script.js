(function(){
  var h = location.hostname;
  var allowed = ['admin-beta.strapiorbit.cloud', 'localhost', '127.0.0.1'];
  if (allowed.indexOf(h) === -1) {
    location.replace('https://admin-beta.strapiorbit.cloud/');
  }
})();
