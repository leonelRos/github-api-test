const fs = require('fs');
const request = require('request-promise');
const querystring = require('querystring');
const env = require('dotenv').config()

var github = {
  token: null,
  userAgent: null,
  apiData: [],
  getAllTaggedRepos: function() {
    return request({
      "method": "GET",
      "uri": "https://api.github.com/search/repositories?q=topic:hack-for-la&sort=updated&order=desc",
      "json": true,
      "headers": {
        "Authorization": "token " + github.token,
        "User-Agent": github.userAgent
      }
    }).then(function(body) {
      body.items.forEach(function(project) {
        github.apiData.push({
          id: project.id,
          name: project.name,
          languages: { url: project.languages_url, data: [] },
          contributors: { url: project.contributors_url, data: [] },
          issues: { url: project.issues_url.substring(0, project.issues_url.length-9), data: [] }
        });
      });
    }).catch(function(err) {
      return err.message;
    });
  },
  getLanguageInfo: function(url) {
    return request({
      "method": "GET",
      "uri": url,
      "json": true,
      "headers": {
        "Authorization": "token " + github.token,
        "User-Agent": github.userAgent
      }
    }).then(function(body) {
      // The body contains an ordered list of languge + lines of code.
      // We care about the order of the names but not the number of lines of code.
      return Promise.resolve(Object.keys(body));
    }).catch(function(err) {
        return err.message;
    });
  },
  getContributorsInfo: function(url) {
    return request({
      "method": "GET",
      "uri": url,
      "json": true,
      "headers": {
        "Authorization": "token " + github.token,
        "User-Agent": github.userAgent
      }
    }).then(function(body) {
      // return a list of contributors sorted by number of commits
      let contributors = [];
      body.forEach(function(user) {
        contributors.push({
          "id": user.id,
          "github_url": user.html_url,
          "avatar_url": user.avatar_url,
          "gravatar_id": user.gravatar_id
        });
      });
      return Promise.resolve(contributors);
    }).catch(function(err) {
        return err.message;
    });
  },
  getIssues: function(url){
    return request({
      "method": "GET",
      "uri": url + "?state=all",
      "json": true,
      "resolveWithFullResponse": true,
      "headers": {
        "Authorization": "token " + github.token,
        "User-Agent": github.userAgent
      }
    }).then(async function(response){
      // Get the total amount of pages in the response
      let issues = [];
      let links = response.headers.link.split(",");
      let lastPageString = links[1]; // NEED TO CHECK WHAT HAPPENS IF THERE IS ONLY ONE PAGE
      let lastPageTrim = lastPageString.split(";")[0].trim();
      let lastPageUrl = lastPageTrim.substring(1, lastPageTrim.length - 1);
      let parsed = querystring.parse(lastPageUrl, "&", "=");
      let lastPage = parsed.page;
      // Loop through every page possible in response
      for(i = 1; i <= lastPage; i++){
        // Construct url
        let url = `${response.request.href}&page=${i}`;
        console.log(url);
        issues.push(github.getIssuesHelper(url));
      }
      Promise.all(issues).then(function(result){
        return Promise.resolve(result);
      });
    }).catch(function(err){
      return err.message;
    });
  },
  getIssuesHelper: function(url){
    return request({
      "method": "GET",
      "uri": url,
      "json": true,
      "headers": {
        "Authorization": "token " + github.token,
        "User-Agent": github.userAgent
      }
    }).then(function(body){
      return Promise.resolve(body);
    }).catch(function(err){
      return err.message;
    });
  }
}

async function main(params) {
  console.log('In the async function main');
  github.token = params.token;
  github.userAgent = params.agent;

  await github.getAllTaggedRepos();
  let lps = [], ldone = false
  let cps = [], cdone = false
  let ips = [], idone = false
  for (i = 0; i < github.apiData.length; i++) {
    lps.push(github.getLanguageInfo(github.apiData[i].languages.url));
    cps.push(github.getContributorsInfo(github.apiData[i].contributors.url));
    ips.push(github.getIssues(github.apiData[i].issues.url));
  }
  /*
  Promise.all(lps)
    .then(function(ls) {
      for (i = 0; i < ls.length; i++) {
        github.apiData[i].languages.data = ls[i]
      }
      ldone = true
      if (cdone) finish()
    })
    .catch(function(e) {
      console.log(e)
    });
  Promise.all(cps)
    .then(function(cs) {
      for (i = 0; i < cs.length; i++) {
        github.apiData[i].contributors.data = cs[i]
      }
      cdone = true
      if (ldone) finish()
    })
    .catch(function(e) {
      console.log(e)
    });
  */
 Promise.all(ips)
  .then(function(is) {
    for (i = 0; i < is.length; i++) {
      github.apiData[i].issues.data = is[i];
    }
    finish()
  })
  .catch(function(e) {
    console.log(e)
  });

  function finish(){
    fs.writeFileSync('github-data.json', JSON.stringify(github.apiData, null, 2));
  }
}

let token = process.env.token;
main({ 
    'token': token,
    'agent': 'KianBadie' 
});