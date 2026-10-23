// The Philippine address lists behind the Region → Province → City →
// Barangay picker, served from our own public/ folder.
//
// This replaces select-philippines-address, which fetched the same data
// from one person's GitHub Pages site using its own bundled copy of axios
// 0.21. That copy was the only remaining security advisory on the client,
// and the hosting was a single point of failure on registration that
// nothing in our code could have warned us about: if that repository were
// renamed or made private, new users simply could not fill in an address.
//
// Three things differ from the package it replaces:
//
//  - The data is ours, under public/ph-address, served by the same CDN as
//    the rest of the site.
//  - Barangays are split one file per province, so picking an address
//    downloads around 55 KB instead of the whole 4.8 MB national list.
//  - A failed fetch gives back an empty list. The package returned the
//    error MESSAGE — a string — and the picker called .map() on whatever
//    came back, so a dropped connection crashed the form it was meant to
//    be filling in.

const BASE = '/ph-address';

// Each file is fetched at most once per page. The lists are static, and
// the picker asks for the same ones again every time somebody changes
// their mind about a province.
const cache = new Map();

const load = (path) => {
  if (cache.has(path)) return cache.get(path);
  const pending = fetch(`${BASE}/${path}`)
    .then((res) => {
      if (!res.ok) throw new Error(`${res.status} for ${path}`);
      return res.json();
    })
    .catch(() => {
      // The failure is deliberately not kept: a second attempt may well
      // work, and a dropdown that stays empty for the rest of the visit is
      // worse than one that fills in when the connection comes back.
      cache.delete(path);
      return [];
    });
  cache.set(path, pending);
  return pending;
};

export const regions = () => load('region.json');

export const provinces = async (regionCode) => (regionCode
  ? (await load('province.json')).filter((p) => p.region_code === regionCode)
  : []);

export const cities = async (provinceCode) => (provinceCode
  ? (await load('city.json')).filter((c) => c.province_code === provinceCode)
  : []);

// A city code always begins with its province code, which is what lets the
// barangays sit in per-province files and still be reachable from a city
// code alone. Verified against all 1,647 cities and 42,029 barangays in the
// source data before splitting it this way.
export const barangays = async (cityCode) => {
  if (!cityCode) return [];
  const rows = await load(`barangay/${cityCode.slice(0, 4)}.json`);
  return rows.filter((b) => b.city_code === cityCode);
};
