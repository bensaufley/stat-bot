require('dotenv').config({ silent: true });

const SLACK_TOKEN = process.env.SLACK_TOKEN,
      CHANNELS = process.env.CHANNELS.split(','),
      TIME_REGEX = /(\d+)?[:`](\d{1,2})(?!\d|:)/;

const request = require('request-promise'),
      fs = require('pn/fs'),
      svg2png = require('svg2png'),
      StatBotRenderer = require('./statbot-renderer');

module.exports = class StatBot {
  constructor(date = new Date(), debug = false) {
    date.setHours(0, 0, 0, 0);
    this.debug = debug;
    this.beginningOfDay = date;
    this.endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
    this.messages = [];
    this.users = [];
    this.rankings = {};
  }

  getUsers() {
    if (this.users.length > 0) return Promise.resolve();
    return this.getJson('https://slack.com/api/users.list')
      .then((response) => {
        if (this.debug) { console.log(response); }
        let json = response.body;
        this.users = json.members
      });
  }

  getMessages(channel_id) {
    return this.getJson(
      'https://slack.com/api/channels.history', {
        channel: channel_id,
        oldest: +this.beginningOfDay/1000,
        latest: +this.endOfDay/1000
      }
    );
  }

  getRankings() {
    return this.getUsers()
      .then(() => Promise.all(CHANNELS.map(id => this.getMessages(id) )))
      .then((data) => {
        data.forEach((response) => {
          if (this.debug) { console.log(response, response.body.messages); }
          let channel = response.request._rp_options.qs.channel,
              json = response.body;
          this.rankings[channel] = this.generateRankings(json.messages);
          if (this.debug) { console.log(channel, this.rankings[channel]); }
        });
      }, (err) => {
        console.log('Error:', err);
      });
  }

  getJson(url, qs = {}) {
    qs.token = SLACK_TOKEN;
    return request.get({
      url: url,
      qs: qs,
      json: true,
      resolveWithFullResponse: true
    });
  }

  generateRankings(messages) {
    let rankings = messages.filter(m => TIME_REGEX.test(m.text))
      .map(this.processMessages.bind(this)).sort(this.rankSort.bind(this));
    return rankings;
  }

  processMessages(m) {
    let user = this.users.filter(u=>u.id == m.user)[0],
        result = m.text.match(TIME_REGEX).splice(1,2).map(i=>i && parseInt(i, 10)),
        seconds = result[0] * 60 + result[1];
    return {
      name: user.profile.real_name || user.profile.name,
      result: seconds,
      text: m.text,
      when: new Date(parseFloat(m.ts, 10) * 1000)
    };
  }

  render(rankingsKey) {
    let renderer = new StatBotRenderer();
    renderer.render(this.rankings[rankingsKey])
      .then(svg => { console.log(svg); return svg2png(Buffer.from(svg)) })
      .then(buffer => fs.writeFile(`./tmp/${rankingsKey}-${+(new Date())}.png`, buffer))
      .then(() => console.log('finished writing'))
      .catch(e => console.error(e));
  }

  rankSort(a, b) {
    if (a.result < b.result) return -1;
    if (a.result > b.result) return 1;
    if (a.name[1] < a.name[1]) return -1;
    if (a.name[1] > a.name[1]) return 1;
    if (a.name[0] < a.name[0]) return -1;
    if (a.name[0] > a.name[0]) return 1;
    return 0;
  }
}
