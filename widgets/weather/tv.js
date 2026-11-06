import Widget from '../../app/Widget.js';
import { h } from '../../app/dom.js';
import { describeWeather, buildUrl } from './codes.js';
import { buildVigilanceUrl, parseVigilance, vigilanceText } from './vigilance.js';
import { pickHours } from './hourly.js';
import { formatHour, dayLength, uvLevel, aqiLevel, buildAirUrl } from './extras.js';
import clearDay from './assets/clear-day.svg';
import clearNight from './assets/clear-night.svg';
import partlyDay from './assets/partly-day.svg';
import partlyNight from './assets/partly-night.svg';
import cloud from './assets/cloud.svg';
import fog from './assets/fog.svg';
import drizzle from './assets/drizzle.svg';
import rain from './assets/rain.svg';
import snow from './assets/snow.svg';
import storm from './assets/storm.svg';

const ICONS = {
  'clear-day': clearDay, 'clear-night': clearNight, 'partly-day': partlyDay, 'partly-night': partlyNight,
  cloud, fog, drizzle, rain, snow, storm,
};

export default class WeatherWidget extends Widget {
  mount(el, s) {
    this.iconEl = h('div', { className: 'wx-icon' });
    this.tempEl = h('div', { className: 'wx-temp', text: '--°' });
    this.descEl = h('div', { className: 'wx-desc' });
    this.metaEl = h('div', { className: 'wx-meta muted' });
    this.hoursEl = h('div', { className: 'wx-hours' });
    this.daysEl = h('div', { className: 'wx-days' });
    this.extraEl = h('div', { className: 'wx-extra' });
    // Widget étroit (3 colonnes) avec la colonne soleil/UV/air : on retire la grande icône pour lui faire de la place.
    const hasExtras = s.showSun || s.showUv || s.showAir || s.showVigilance;
    // Heures ET jours : tout est réduit (~70 %) pour que les deux lignes tiennent sous la météo actuelle.
    const stacked = s.hours > 0 && s.days > 0;
    if (stacked) el.className += ' wx-stacked';
    const unit = this.size ? this.size.height * (stacked ? 0.7 : 1) : 0;
    if (hasExtras && this.size && this.size.width < unit * 1.7) el.className += ' wx-compact';
    el.appendChild(h('div', { className: 'wx-now' },
      this.iconEl,
      h('div', { className: 'wx-main' },
        h('div', { className: 'wx-place muted', text: s.label }),
        this.tempEl, this.descEl, this.metaEl),
      hasExtras ? this.extraEl : null));
    if (s.hours > 0) el.appendChild(this.hoursEl);
    if (s.days > 0) el.appendChild(this.daysEl);

    this.every(s.refreshMinutes * 60 * 1000, () => this.refresh());
  }

  async refresh() {
    const s = this.settings;
    // La qualité de l'air est un bonus : si son API échoue, la météo s'affiche quand même.
    const air = s.showAir
      ? this.fetchJson(buildAirUrl(s)).then((r) => r.current || null, () => null)
      : Promise.resolve(null);
    // Vigilance : service non officiel, facultatif lui aussi. null = indisponible / format inattendu.
    const vigi = s.showVigilance
      ? this.fetchJson(buildVigilanceUrl(s)).then(parseVigilance, () => null)
      : Promise.resolve(null);
    const data = await this.fetchJson(buildUrl(s));
    this.renderExtras(data.daily, await air, await vigi);
    const c = data.current;
    const now = describeWeather(c.weather_code, c.is_day === 1);
    this.iconEl.innerHTML = ICONS[now.icon];
    this.tempEl.textContent = Math.round(c.temperature_2m) + '°';
    this.descEl.textContent = now.label;
    this.metaEl.textContent = 'Ressenti ' + Math.round(c.apparent_temperature) + '° · '
      + Math.round(c.relative_humidity_2m) + ' % · ' + Math.round(c.wind_speed_10m) + ' km/h';

    this.renderHours(data);

    this.daysEl.innerHTML = '';
    const d = data.daily;
    for (let i = 1; i <= this.settings.days && i < d.time.length; i++) {
      const day = describeWeather(d.weather_code[i], true);
      const name = new Date(d.time[i] + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
      const rainProb = d.precipitation_probability_max ? d.precipitation_probability_max[i] : null;
      this.daysEl.appendChild(h('div', { className: 'wx-day' },
        h('div', { className: 'wx-day-name', text: name }),
        h('div', { className: 'wx-day-icon', html: ICONS[day.icon] }),
        h('div', { className: 'wx-day-temp' },
          h('span', { text: Math.round(d.temperature_2m_max[i]) + '°' }),
          h('span', { className: 'muted', text: ' ' + Math.round(d.temperature_2m_min[i]) + '°' })),
        rainProb != null ? h('div', { className: 'wx-day-rain', text: '💧' + rainProb + ' %' }) : null));
    }
  }

  /** Ligne des heures à venir : heure, icône, température, risque de pluie. */
  renderHours(data) {
    const s = this.settings;
    this.hoursEl.innerHTML = '';
    if (!(s.hours > 0)) return;
    const now = data.current && data.current.time;
    pickHours(data.hourly, now, s.hours, Number(s.hoursStep)).forEach((x) => {
      const w = describeWeather(x.code, x.isDay);
      this.hoursEl.appendChild(h('div', { className: 'wx-hour' },
        h('div', { className: 'wx-hour-name muted', text: x.hour }),
        h('div', { className: 'wx-hour-icon', html: ICONS[w.icon] }),
        h('div', { className: 'wx-hour-temp', text: x.temp + '°' }),
        x.rain != null ? h('div', { className: 'wx-day-rain', text: '💧' + x.rain + ' %' }) : null));
    });
  }

  /** Colonne de droite : vigilance, soleil, UV du jour, qualité de l'air. */
  renderExtras(d, air, vigi) {
    const s = this.settings;
    const rows = [];
    if (s.showVigilance) {
      // En tête de colonne : c'est l'info la plus importante quand elle est jaune ou plus.
      const lvl = vigi ? vigi.level : 0;
      rows.push(h('div', { className: 'wx-extra-row wx-vigi wx-vigi-' + lvl + (lvl >= 2 ? '' : ' muted') },
        lvl >= 2 ? h('span', { className: 'wx-dot wx-vigi-dot-' + lvl }) : null,
        h('span', { text: vigilanceText(vigi) })));
    }
    if (s.showSun && d.sunrise && d.sunset) {
      const rise = formatHour(d.sunrise[0]);
      const set = formatHour(d.sunset[0]);
      const len = dayLength(d.sunrise[0], d.sunset[0]);
      if (rise && set) {
        rows.push(h('div', { className: 'wx-extra-row' },
          h('span', { className: 'wx-extra-k', text: '☀' }),
          h('span', { text: rise + ' – ' + set })));
        if (len) rows.push(h('div', { className: 'wx-extra-sub muted', text: 'Jour : ' + len }));
      }
    }
    const uv = s.showUv && d.uv_index_max ? uvLevel(d.uv_index_max[0]) : null;
    if (uv) {
      rows.push(h('div', { className: 'wx-extra-row' },
        h('span', { className: 'wx-dot wx-uv-' + uv.level }),
        h('span', { text: 'UV ' + uv.value + ' · ' + uv.label })));
    }
    if (s.showAir) {
      const aqi = air ? aqiLevel(air.european_aqi) : null;
      rows.push(aqi
        ? h('div', { className: 'wx-extra-row' },
          h('span', { className: 'wx-dot wx-aqi-' + aqi.level }),
          h('span', { text: 'Air ' + aqi.value + ' · ' + aqi.label }))
        : h('div', { className: 'wx-extra-row muted', text: 'Air : indisponible' }));
      if (aqi && air.pm2_5 != null) {
        rows.push(h('div', { className: 'wx-extra-sub muted', text: 'PM2.5 : ' + Math.round(air.pm2_5) + ' µg/m³' }));
      }
    }
    this.extraEl.innerHTML = '';
    rows.forEach((r) => this.extraEl.appendChild(r));
  }
}
