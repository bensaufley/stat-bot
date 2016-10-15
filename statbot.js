require('dotenv').config({ silent: true });

const SLACK_TOKEN = process.env.SLACK_TOKEN,
      CHANNELS = process.env.CHANNELS.split(','),
      TIME_REGEX = /(\d+)?[:`](\d{1,2})(?!\d|:)/;

const request = require('request-promise');

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
      .then(() => Promise.all(CHANNELS.map(id => this.getMessages(id))))
      .then((data) => {
        data.forEach((response) => {
          if (this.debug) { console.log(response); }
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
    return messages.filter(m => TIME_REGEX.test(m.text))
      .map(this.processMessages.bind(this)).sort(this.rankSort.bind(this));
  }

  processMessages(m) {
    let user = this.users.filter(u=>u.id == m.user)[0],
        result = m.text.match(TIME_REGEX).splice(1,2).map(i=>i && parseInt(i, 10));
    return {
      name: user.profile.real_name || user.profile.name,
      result: result,
      formattedResult: this.timeFormat(...result),
      text: m.text,
      when: new Date(parseFloat(m.ts, 10) * 1000)
    };
  }

  timeFormat(min, sec) {
    return `${min || 0}:${sec.toString().length < 2 ? `0${sec}` : sec}`;
  }

  rankSort(a, b) {
    if (a.result[0] < b.result[0]) return -1;
    if (a.result[0] > b.result[0]) return 1;
    if (a.result[1] < b.result[1]) return -1;
    if (a.result[1] > b.result[1]) return 1;
    if (a.name[1] < a.name[1]) return -1;
    if (a.name[1] > a.name[1]) return 1;
    if (a.name[0] < a.name[0]) return -1;
    if (a.name[0] > a.name[0]) return 1;
    return 0;
  }
}
