const d3 = require('d3');
const moment = require('moment');
const topojson = require('topojson');
require('d3-geo-projection');

(function map() {
  /* eslint-disable no-param-reassign */
  /* eslint-disable no-bitwise */
  function alea(s0, s1, c) {
    return function aleaStep() {
      const t = 2091639 * s0 + c * 2.3283064365386963e-10;
      s0 = s1;
      return (s1 = t - (c = t | 0));
    };
  }

  function aleaFromSeed(seed) {
    let s0;
    let s1;
    let h;
    let n = 0xefc8249d;
    let v;
    seed = `X${seed || +new Date()}`;
    for (let i = 0; i < 2; i += 1) {
      for (let j = 0; j < seed.length; j += 1) {
        n += seed.charCodeAt(j);
        h = 0.02519603282416938 * n;
        n = h >>> 0;
        h -= n;
        h *= n;
        n = h >>> 0;
        h -= n;
        n += h * 0x100000000;
      }
      v = (n >>> 0) * 2.3283064365386963e-10;
      if (i === 0) s0 = v;
      else s1 = v;
    }
    return alea(s0, s1, 1);
  }
  /* eslint-enable no-param-reassign */

  const random = aleaFromSeed(12530);

  d3.labeler = function l() {
    let lab = [];
    let anc = [];
    let w = 1; // box width
    let h = 1; // box width
    const labeler = {};

    const max_move = 5.0;
    const max_angle = 0.5;

    // weights
    const w_len = 0.2; // leader line length
    const w_inter = 1.0; // leader line intersection
    const w_lab2 = 30.0; // label-label overlap
    const w_lab_anc = 30.0; // label-anchor overlap
    const w_orient = 3.0; // orientation bias

    // booleans for user defined functions
    let user_energy = false;

    let user_defined_energy;

    const intersect = (x1, x2, x3, x4, y1, y2, y3, y4) => {
      // returns true if two lines intersect, else false
      // from http://paulbourke.net/geometry/lineline2d/

      const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
      const numera = (x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3);
      const numerb = (x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3);

      /* Is the intersection along the the segments */
      const mua = numera / denom;
      const mub = numerb / denom;
      if (!(mua < 0 || mua > 1 || mub < 0 || mub > 1)) {
        return true;
      }
      return false;
    };
    function energy(index) {
      // energy function, tailored for label placement

      const m = lab.length;
      let ener = 0;
      let dx = lab[index].x - anc[index].x;
      let dy = anc[index].y - lab[index].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let overlap = true;

      // penalty for length of leader line
      if (dist > 0) {
        ener += dist * w_len;
      }

      // label orientation bias
      dx /= dist;
      dy /= dist;
      if (dx > 0 && dy > 0) {
        ener += 0 * w_orient;
      } else if (dx < 0 && dy > 0) {
        ener += 1 * w_orient;
      } else if (dx < 0 && dy < 0) {
        ener += 2 * w_orient;
      } else {
        ener += 3 * w_orient;
      }

      const x21 = lab[index].x;
      const y21 = lab[index].y - lab[index].height + 2.0;
      const x22 = lab[index].x + lab[index].width;
      const y22 = lab[index].y + 2.0;
      let x11;
      let x12;
      let y11;
      let y12;
      let x_overlap;
      let y_overlap;
      let overlap_area;

      for (let i = 0; i < m; i += 1) {
        if (i !== index) {
          // penalty for intersection of leader lines
          overlap = intersect(
            anc[index].x,
            lab[index].x,
            anc[i].x,
            lab[i].x,
            anc[index].y,
            lab[index].y,
            anc[i].y,
            lab[i].y
          );
          if (overlap) ener += w_inter;

          // penalty for label-label overlap
          x11 = lab[i].x;
          y11 = lab[i].y - lab[i].height + 2.0;
          x12 = lab[i].x + lab[i].width;
          y12 = lab[i].y + 2.0;
          x_overlap = Math.max(0, Math.min(x12, x22) - Math.max(x11, x21));
          y_overlap = Math.max(0, Math.min(y12, y22) - Math.max(y11, y21));
          overlap_area = x_overlap * y_overlap;
          ener += overlap_area * w_lab2;
        }

        // penalty for label-anchor overlap
        x11 = anc[i].x - anc[i].r;
        y11 = anc[i].y - anc[i].r;
        x12 = anc[i].x + anc[i].r;
        y12 = anc[i].y + anc[i].r;
        x_overlap = Math.max(0, Math.min(x12, x22) - Math.max(x11, x21));
        y_overlap = Math.max(0, Math.min(y12, y22) - Math.max(y11, y21));
        overlap_area = x_overlap * y_overlap;
        ener += overlap_area * w_lab_anc;
      }
      return ener;
    }

    /* eslint-disable no-unused-vars */
    let user_defined_schedule;
    let user_schedule = false;
    let acc = 0;
    let rej = 0;
    /* eslint-enable no-unused-vars */
    const mcmove = currT => {
      // Monte Carlo translation move

      // select a random label
      const i = Math.floor(random() * lab.length);

      // save old coordinates
      const x_old = lab[i].x;
      const y_old = lab[i].y;

      // old energy
      let old_energy;
      if (user_energy) {
        old_energy = user_defined_energy(i, lab, anc);
      } else {
        old_energy = energy(i);
      }

      // random translation
      lab[i].x += (random() - 0.5) * max_move;
      lab[i].y += (random() - 0.5) * max_move;

      // hard wall boundaries
      if (lab[i].x > w) lab[i].x = x_old;
      if (lab[i].x < 0) lab[i].x = x_old;
      if (lab[i].y > h) lab[i].y = y_old;
      if (lab[i].y < 0) lab[i].y = y_old;

      // new energy
      let new_energy;
      if (user_energy) {
        new_energy = user_defined_energy(i, lab, anc);
      } else {
        new_energy = energy(i);
      }

      // delta E
      const delta_energy = new_energy - old_energy;

      if (random() < Math.exp(-delta_energy / currT)) {
        acc += 1;
      } else {
        // move back to old coordinates
        lab[i].x = x_old;
        lab[i].y = y_old;
        rej += 1;
      }
    };

    const mcrotate = currT => {
      // Monte Carlo rotation move

      // select a random label
      const i = Math.floor(random() * lab.length);

      // save old coordinates
      const x_old = lab[i].x;
      const y_old = lab[i].y;

      // old energy
      let old_energy;
      if (user_energy) {
        old_energy = user_defined_energy(i, lab, anc);
      } else {
        old_energy = energy(i);
      }

      // random angle
      const angle = (random() - 0.5) * max_angle;

      const s = Math.sin(angle);
      const c = Math.cos(angle);

      // translate label (relative to anchor at origin):
      lab[i].x -= anc[i].x;
      lab[i].y -= anc[i].y;

      // rotate label
      const x_new = lab[i].x * c - lab[i].y * s;
      const y_new = lab[i].x * s + lab[i].y * c;

      // translate label back
      lab[i].x = x_new + anc[i].x;
      lab[i].y = y_new + anc[i].y;

      // hard wall boundaries
      if (lab[i].x > w) lab[i].x = x_old;
      if (lab[i].x < 0) lab[i].x = x_old;
      if (lab[i].y > h) lab[i].y = y_old;
      if (lab[i].y < 0) lab[i].y = y_old;

      // new energy
      let new_energy;
      if (user_energy) {
        new_energy = user_defined_energy(i, lab, anc);
      } else {
        new_energy = energy(i);
      }

      // delta E
      const delta_energy = new_energy - old_energy;

      if (random() < Math.exp(-delta_energy / currT)) {
        acc += 1;
      } else {
        // move back to old coordinates
        lab[i].x = x_old;
        lab[i].y = y_old;
        rej += 1;
      }
    };

    const cooling_schedule = (
      currT,
      initialT,
      nsweeps
      // linear cooling
    ) => currT - initialT / nsweeps;

    labeler.start = function start(nsweeps) {
      // main simulated annealing function
      const m = lab.length;
      let currT = 1.0;
      const initialT = 1.0;

      for (let i = 0; i < nsweeps; i += 1) {
        for (let j = 0; j < m; j += 1) {
          if (random() < 0.5) {
            mcmove(currT);
          } else {
            mcrotate(currT);
          }
        }
        currT = cooling_schedule(currT, initialT, nsweeps);
      }
    };

    labeler.width = function width(x) {
      // users insert graph width
      if (!arguments.length) return w;
      w = x;
      return labeler;
    };

    labeler.height = function height(x) {
      // users insert graph height
      if (!arguments.length) return h;
      h = x;
      return labeler;
    };

    labeler.label = function label(x) {
      // users insert label positions
      if (!arguments.length) return lab;
      lab = x;
      return labeler;
    };

    labeler.anchor = function anchor(x) {
      // users insert anchor positions
      if (!arguments.length) return anc;
      anc = x;
      return labeler;
    };

    labeler.alt_energy = function alt_energy(x) {
      // user defined energy
      if (!arguments.length) return energy;
      user_defined_energy = x;
      user_energy = true;
      return labeler;
    };

    labeler.alt_schedule = x => {
      // user defined cooling_schedule
      if (!arguments.length) return cooling_schedule;
      user_defined_schedule = x;
      user_schedule = true;
      return labeler;
    };

    return labeler;
  };
  const elt = d3.select('#map');
  const eltRect = elt.node().getBoundingClientRect();
  const width = eltRect.width;
  const height = eltRect.height;

  const rollover = d3.select('#map-rollover');
  rollover.style('width', `${width - 60}px`).style('top', `${height - 100}px`);

  const projection = d3
    .geoMercator()
    .center([10, 0])
    .scale(140)
    .rotate([-180, 0]);

  const svg = elt
    .append('svg')
    .classed('map', true)
    .style('background-color', '#d2e8d7')
    .attr('width', width)
    .attr('height', height);

  const path = d3.geoPath().projection(projection);

  // load and display the World
  d3.json('world-simp.json', (error, topology) => {
    const g = svg.append('g');
    g
      .selectAll('path')
      .data(topojson.feature(topology, topology.objects.countries).features)
      .enter()
      .append('path')
      .attr('d', path);

    // load and display the cities
    d3.json('flags-with-location.js', (d3err, data) => {
      const markers = [];
      const labels = [];
      const seen = {};
      const previous = {};
      const counters = {
        countries: {},
        cities: {},
        events: 0
      };
      const lastYear = moment().startOf('year').subtract(1, 'year');
      data.flags.forEach(flag => {
        const d = Object.assign({}, flag);
        d.flagName = d.country.replace(/\s*/g, '');
        d.startDate = moment(d.start, 'DD MMMM YYYY');
        if (!d.startDate.isValid()) d.startDate = moment();
        d.endDate = moment(d.end, 'DD MMMM YYYY');
        if (d.startDate.format() === d.endDate.format()) {
          d.startEnd = d.endDate.format('D MMMM YYYY');
        } else if (d.startDate.month() === d.endDate.month()) {
          d.startEnd = `${d.startDate.format('D')}-${d.endDate.format('D MMMM YYYY')}`;
        } else if (d.startDate.year() === d.endDate.year()) {
          d.startEnd = `${d.startDate.format('D MMMM')} - ${d.endDate.format('D MMMM YYYY')}`;
        } else {
          d.startEnd = `${d.startDate.format('D MMMM YYYY')} - ${d.endDate.format('D MMMM YYYY')}`;
        }

        const name = d.transliterated_name || d.name;
        d.label = `${name}, ${d.country}`;

        counters.events += 1;
        counters.countries[d.country] = 1;
        counters.cities[d.label] = 1;

        if (d.startDate.isAfter()) {
          d.upcoming = `Upcoming: <a href="${d.url}">${d.startEnd}</a>`;
        } else if (d.startDate.isAfter(lastYear)) {
          d.upcoming = 'Upcoming: Stay tuned!';
          if (!previous[d.label]) {
            previous[
              d.label
            ] = `Previously: <a href="${d.url}">${d.startEnd}</a>`;
          }
        } else {
          d.upcoming = `Upcoming: <a href="mailto:ariel@sciencehackday.org?subject=I'd like to organize Science Hack Day in ${name}">Organize the next one!</a>`;
          if (!previous[d.label]) {
            previous[
              d.label
            ] = `Previously: <a href="${d.url}">${d.startEnd}</a>`;
          }
        }

        if (seen[d.name]) {
          if (!previous[d.label]) {
            previous[
              d.label
            ] = `Previously: <a href="${d.url}">${d.startEnd}</a>`;
          }
        }

        if (!seen[d.name]) {
          const c = projection([180 + d.longitude, d.latitude]);

          markers.push({ x: c[0] || -10000, y: c[1] || -10000, r: 6 });
          labels.push({
            x: c[0] || -10000,
            y: c[1] || -10000,
            startDate: d.startDate,
            endDate: d.endDate,
            startEnd: d.startEnd,
            url: d.url,
            upcoming: d.upcoming,
            country: d.flagName,
            label: d.label,
            name: name.toUpperCase(),
            width: 0.0,
            height: 0.0
          });
          seen[d.name] = 1;
        }
      });
      counters.countries = Object.keys(counters.countries).length;
      counters.cities = Object.keys(counters.cities).length;
      d3
        .select('#rollover-initial')
        .html(
          `${counters.events} events, ${counters.cities} cities, ${counters.countries} countries`
        );
      d3.select('#rollover-upcoming').html('');
      d3.select('#rollover-previous').html('');

      const lines = g.append('g');

      g
        .selectAll('circle')
        .data(markers)
        .enter()
        .append('circle')
        .attr('id', (d, i) => `circle-${i}`)
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .attr('r', 6)
        .style('opacity', '0.7')
        .style('fill', '#999');

      const labelTexts = g
        .selectAll('text')
        .data(labels)
        .enter()
        .append('text')
        .classed('map-text', true)
        .attr('text-anchor', d => d.position || 'start')
        .text(d => d.name)
        .style('fill', 'black')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('font-family', 'blackoutmidnight')
        .style('opacity', '0.0');

      labelTexts.on('click', d => {
        d3.event.stopPropagation();
        d3.selectAll('#map-rollover div').style('display', 'block');
        d3.select('#rollover-initial').style('display', 'none');
        d3
          .select('#rollover-img')
          .style('opacity', 1.0)
          .attr(
            'src',
            `http://sciencehackday.org/images/flags/${d.country}.png`
          );
        d3.select('#rollover-location').html(d.label);
        d3.select('#rollover-upcoming').html(d.upcoming);
        d3.select('#rollover-previous').html(previous[d.label]);
        rollover.transition().duration(250).style('opacity', 1.0);
      });
      labelTexts.on('mouseover', (d, i, nodes) => {
        g
          .selectAll('text')
          .transition()
          .duration(250)
          .style('font-size', '12px')
          .style('opacity', '0.1');
        d3.select(`#line-${i}`).transition().style('opacity', '0.9');

        g.selectAll('circle').transition().style('opacity', '0.1');
        d3.select(`#circle-${i}`).transition().style('opacity', '0.9');

        d3
          .select(nodes[i])
          .transition()
          .duration(250)
          .style('font-size', '20px')
          .style('opacity', '1.0');
      });
      labelTexts.on('mouseout', (d, i) => {
        g
          .selectAll('text')
          .transition()
          .duration(250)
          .style('font-size', '12px')
          .style('opacity', '0.7');
        g
          .selectAll('circle')
          .transition()
          .duration(250)
          .style('opacity', '0.7');
        d3.select(`#line-${i}`).transition().style('opacity', '0.0');
      });

      let index = 0;
      labelTexts.each((d, i, nodes) => {
        labels[index].width = nodes[i].getBBox().width;
        labels[index].height = nodes[i].getBBox().height;
        index += 1;
      });

      process.nextTick(() => {
        d3
          .labeler()
          .label(labels)
          .anchor(markers)
          .width(width)
          .height(height)
          .start(500);
        svg
          .selectAll('text.map-text')
          .style('opacity', '0.8')
          .attr('x', d => d.x)
          .attr('y', d => d.y)
          .attr('dx', () => 1)
          .attr('dy', d => d.height / 2 + 1);

        lines
          .selectAll('line')
          .data(labels)
          .enter()
          .append('line')
          .attr('x1', d => d.x - 2)
          .attr('y1', d => d.y)
          .attr('x2', (d, i) => markers[i].x)
          .attr('y2', (d, i) => markers[i].y)
          .style('opacity', '0.0')
          .attr('stroke', '#999')
          .attr('id', (d, i) => `line-${i}`)
          .attr('stroke-width', (d, i) => {
            const x1 = d.x;
            const y1 = d.y;
            const x2 = markers[i].x;
            const y2 = markers[i].y;
            if ((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1) > 300) {
              return 2;
            }
            return 0;
          });
      }, 1);
    });
  });
})();
