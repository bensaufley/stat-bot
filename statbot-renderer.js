const D3Node = require('d3-node'),
      fs = require('pn/fs'),
      extend = require('extend');

module.exports = class StatBotRenderer {
  constructor(opts = {}) {
    let defaults = {
      margin: {
        top: 20,
        right: 20,
        bottom: 120,
        left: 60
      },
      width: 800,
      height: 600,
      timeIntervals: 30
    };
    this.opts = extend(true, {}, defaults, opts);
  }

  render(rankings) {
    return fs.readFile('./css/svg.css', 'utf-8')
      .then((css) => {
        let data = rankings.slice(0).reverse(),
            d3n = new D3Node({ svgStyles: css }),
            d3 = d3n.d3,
            margin = this.opts.margin,
            width = this.opts.width - margin.left - margin.right,
            height = this.opts.height - margin.top - margin.bottom,
            lastPlace = data[0],
            median = d3.mean(data.map(d => d.result)),
            upperBound = Math.ceil(lastPlace.result / this.opts.timeIntervals) * this.opts.timeIntervals + 15,
            svg = d3n.createSVG()
              .attr('width', this.opts.width)
              .attr('height', this.opts.height)
            .append('g')
              .attr('transform', `translate(${margin.left}, ${margin.top})`),
            x = d3.scale.ordinal()
              .rangeRoundBands([0, width], .1)
              .domain(d3.range(0, data.length, 1)),
            y = d3.scale.linear()
              .range([height, 0], .1)
              .domain([0, upperBound]),
            xAxis = d3.svg.axis()
              .scale(x)
              .orient('bottom')
              .tickFormat(i => data[i].name),
            yAxis = d3.svg.axis()
              .scale(y)
              .orient('left')
              .ticks(Math.ceil(lastPlace.result / this.opts.timeIntervals))
              .tickFormat(this.timeFormat);

        data.forEach(r => { if (r.result == null) r.result = upperBound });
        svg.append('g')
          .attr('class', 'x axis')
          .attr('transform', `translate(0, ${height})`)
          .call(xAxis)
        .selectAll('text')
          .style('text-anchor', 'end')
          .attr('dx', '-.8em')
          .attr('dy', '-.55em')
          .attr('transform', 'rotate(-90)');
        svg.append('g')
          .attr('class', 'y axis')
          .call(yAxis)
        svg.selectAll('bar')
          .data(data)
          .enter().append('rect')
            .attr('x', (d, i) => x(i))
            .attr('width', x.rangeBand())
            .attr('y', d => y(d.result))
            .attr('height', d => height - y(d.result))
            .attr('class', (d, i) => {
              if (i == data.length - 1) {
                return 'bar first';
              } else if (d.result < median) {
                return 'bar above-average';
              } else if (d.result == upperBound) {
                return 'bar dnf';
              } else {
                return 'bar';
              }
            });
        return d3n.svgString();
      });
  }

  timeFormat(time) {
    let min = Math.floor(time / 60),
        sec = time % 60;
    return `${min || 0}:${sec.toString().length < 2 ? `0${sec}` : sec}`;
  }
}
