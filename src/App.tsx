/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import { fromLonLat, transformExtent } from 'ol/proj';
import WKT from 'ol/format/WKT';
import { Style, Stroke, Fill } from 'ol/style';
import 'ol/ol.css';
import { 
  Layers, 
  Calendar, 
  Cloud, 
  Search, 
  ChevronDown, 
  Satellite,
  Filter,
  Info,
  Loader2,
  Image as ImageIcon,
  ExternalLink,
  X
} from 'lucide-react';

const SATELLITES = [
  { id: 'sentinel-1', name: 'Sentinel-1', collection: 'SENTINEL-1' },
  { id: 'sentinel-2', name: 'Sentinel-2', collection: 'SENTINEL-2' },
  { id: 'sentinel-3', name: 'Sentinel-3', collection: 'SENTINEL-3' },
  { id: 'sentinel-5p', name: 'Sentinel-5P', collection: 'SENTINEL-5P' },
  { id: 'landsat-5', name: 'Landsat-5', collection: 'LANDSAT-5' },
  { id: 'landsat-7', name: 'Landsat-7', collection: 'LANDSAT-7' },
  { id: 'landsat-8', name: 'Landsat-8', collection: 'LANDSAT-8' },
  { id: 'landsat-9', name: 'Landsat-9', collection: 'LANDSAT-9' },
];

export default function App() {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const footprintSource = useRef<VectorSource>(new VectorSource());

  // Filter States
  const [selectedSatellite, setSelectedSatellite] = useState(SATELLITES[1].id);
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');
  const [cloudCover, setCloudCover] = useState(20);

  // Search Results State
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;

    const initialMap = new Map({
      target: mapElement.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        new VectorLayer({
          source: footprintSource.current,
          style: (feature) => {
            const isSelected = feature.get('id') === selectedItemId;
            return new Style({
              stroke: new Stroke({
                color: isSelected ? '#10b981' : 'rgba(16, 185, 129, 0.5)',
                width: isSelected ? 3 : 1,
              }),
              fill: new Fill({
                color: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.05)',
              }),
              zIndex: isSelected ? 10 : 1,
            });
          },
        }),
      ],
      view: new View({
        center: fromLonLat([0, 0]),
        zoom: 2,
      }),
    });

    initialMap.on('click', (evt) => {
      const feature = initialMap.forEachFeatureAtPixel(evt.pixel, (f) => f);
      if (feature) {
        const id = feature.get('id');
        if (id) {
          setSelectedItemId(id);
          // Scroll to the row in the table
          const element = document.getElementById(`row-${id}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    });

    mapRef.current = initialMap;

    return () => {
      if (mapRef.current) {
        mapRef.current.setTarget(undefined);
        mapRef.current = null;
      }
    };
  }, []);

  // Update footprints when results change
  useEffect(() => {
    if (!results.length) {
      footprintSource.current.clear();
      return;
    }

    footprintSource.current.clear();
    const format = new WKT();

    results.forEach((item) => {
      if (!item.Footprint) return;
      try {
        const wktMatch = item.Footprint.match(/POLYGON\s*\(.*\)/i) || item.Footprint.match(/MULTIPOLYGON\s*\(.*\)/i);
        const wkt = wktMatch ? wktMatch[0] : item.Footprint;

        const feature = format.readFeature(wkt, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        });
        feature.set('id', item.Id);
        footprintSource.current.addFeature(feature);
      } catch (err) {
        console.error('Error parsing footprint for item:', item.Id, err);
      }
    });
  }, [results]);

  // Refresh map style when selection changes
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.getLayers().forEach((layer) => {
        if (layer instanceof VectorLayer) {
          layer.changed();
        }
      });
    }
  }, [selectedItemId]);

  const handleSearch = async () => {
    if (!mapRef.current) return;
    
    setIsLoading(true);
    setError(null);
    setResults([]);
    setSelectedItemId(null);
    footprintSource.current.clear();

    try {
      const view = mapRef.current.getView();
      const extent = view.calculateExtent(mapRef.current.getSize());
      const transformedExtent = transformExtent(extent, 'EPSG:3857', 'EPSG:4326');
      
      // [minLon, minLat, maxLon, maxLat]
      const [minLon, minLat, maxLon, maxLat] = transformedExtent;
      
      // Create WKT Polygon for the extent
      const wkt = `POLYGON((${minLon} ${minLat}, ${maxLon} ${minLat}, ${maxLon} ${maxLat}, ${minLon} ${maxLat}, ${minLon} ${minLat}))`;

      const sat = SATELLITES.find(s => s.id === selectedSatellite);
      const collection = sat?.collection || 'SENTINEL-2';
      
      // Build OData Filter
      let filter = `Collection/Name eq '${collection}'`;
      filter += ` and ContentDate/Start gt ${startDate}T00:00:00.000Z`;
      filter += ` and ContentDate/Start lt ${endDate}T23:59:59.999Z`;
      
      // Cloud cover filter for optical satellites
      const opticalSatellites = ['SENTINEL-2', 'LANDSAT-5', 'LANDSAT-7', 'LANDSAT-8', 'LANDSAT-9'];
      if (opticalSatellites.includes(collection)) {
        filter += ` and Attributes/OData.CSC.DoubleAttribute/any(att:att/Name eq 'cloudCover' and att/Value lt ${cloudCover}.0)`;
      }

      // Spatial filter
      filter += ` and OData.CSC.Intersects(area=geography'SRID=4326;${wkt}')`;

      // Added $expand=Attributes to get cloud cover and other metadata
      const url = `https://catalogue.dataspace.copernicus.eu/odata/v1/Products?$filter=${encodeURIComponent(filter)}&$expand=Attributes&$top=20&$orderby=ContentDate/Start desc`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      setResults(data.value || []);
      
      if (data.value?.length === 0) {
        setError('No imagery found for the selected criteria.');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to fetch imagery. Please try again.');
    } finally {
      setIsLoading(false);
      if (results.length > 0 || error === null) {
        setShowTable(true);
      }
    }
  };

  const handleRowClick = (item: any) => {
    if (!mapRef.current || !item.Footprint) return;

    setSelectedItemId(item.Id);

    const feature = footprintSource.current.getFeatures().find(f => f.get('id') === item.Id);
    if (feature) {
      const extent = feature.getGeometry()?.getExtent();
      if (extent) {
        mapRef.current.getView().fit(extent, {
          padding: [50, 50, 50, 50],
          duration: 1000,
        });
      }
    }
  };

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-96 border-r border-white/10 bg-zinc-900 flex flex-col z-20 shadow-2xl">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Satellite className="w-6 h-6 text-zinc-950" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Copernicus</h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">DataSpace Explorer</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Filters Section */}
          <div className="p-6 space-y-6 border-b border-white/10">
            {/* Satellite Selection */}
            <section className="space-y-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                <Layers className="w-3.5 h-3.5" />
                Satellite Platform
              </label>
              <div className="relative group">
                <select 
                  value={selectedSatellite}
                  onChange={(e) => setSelectedSatellite(e.target.value)}
                  className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all cursor-pointer hover:bg-zinc-700/50"
                >
                  {SATELLITES.map((sat) => (
                    <option key={sat.id} value={sat.id}>{sat.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none group-hover:text-zinc-300 transition-colors" />
              </div>
            </section>

            {/* Date Range */}
            <section className="space-y-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                <Calendar className="w-3.5 h-3.5" />
                Date Range
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-[10px] text-zinc-500 uppercase font-mono ml-1">Start</span>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all [color-scheme:dark]"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] text-zinc-500 uppercase font-mono ml-1">End</span>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all [color-scheme:dark]"
                  />
                </div>
              </div>
            </section>

            {/* Cloud Cover */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  <Cloud className="w-3.5 h-3.5" />
                  Cloud Cover
                </label>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                  {cloudCover}%
                </span>
              </div>
              <div className="px-1">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={cloudCover}
                  onChange={(e) => setCloudCover(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all"
                />
              </div>
            </section>

            {/* Search Button */}
            <button 
              onClick={handleSearch}
              disabled={isLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-950 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
              {isLoading ? 'Searching...' : 'Search Imagery'}
            </button>
          </div>

          {/* Results Section Removed as requested */}
        </div>

        <div className="p-6 border-t border-white/10 bg-zinc-950/50">
          <div className="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-xl border border-white/5">
            <Info className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Search results are limited to the current map view area.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-zinc-900/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 rounded-lg border border-white/10">
              <Filter className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-zinc-300">Active Filters</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <p className="text-xs text-zinc-500 italic">
              Showing results for {SATELLITES.find(s => s.id === selectedSatellite)?.name}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {results.length > 0 && (
              <button 
                onClick={() => setShowTable(!showTable)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border transition-all text-xs font-medium ${
                  showTable 
                    ? 'bg-emerald-500 border-emerald-400 text-zinc-950' 
                    : 'bg-zinc-800 border-white/10 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                {showTable ? 'Hide Table' : 'Show Table'}
              </button>
            )}
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest">OpenLayers v10.x</span>
          </div>
        </header>

        {/* Map Container */}
        <main className="flex-1 relative flex flex-col overflow-hidden">
          <div className="flex-1 relative">
            <div 
              ref={mapElement} 
              className="absolute inset-0 w-full h-full"
              id="map-container"
            />
            
            {/* Overlay UI */}
            <div className={`absolute bottom-6 right-6 z-10 flex flex-col gap-2 transition-all duration-300 ${showTable ? 'translate-y-[-20px] opacity-0 pointer-events-none' : ''}`}>
              <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl max-w-xs">
                <h2 className="text-sm font-medium mb-1">Global View</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Interactive map powered by OpenStreetMap data and OpenLayers rendering engine.
                </p>
              </div>
            </div>
          </div>

          {/* Results Table Panel */}
          {showTable && results.length > 0 && (
            <div className="h-1/3 min-h-[250px] bg-zinc-900 border-t border-white/10 flex flex-col z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Imagery Metadata Table</h3>
                  <span className="text-[10px] px-2 py-0.5 bg-zinc-800 rounded-full text-zinc-500 font-mono">
                    {results.length} items found
                  </span>
                </div>
                <button 
                  onClick={() => setShowTable(false)}
                  className="p-1 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-zinc-900 z-10">
                    <tr className="border-b border-white/5">
                      <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Product Name</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Acquisition Date</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Cloud Cover</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Product Type</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Collection</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {results.map((item) => {
                      const cloudAttr = item.Attributes?.find((a: any) => a.Name === 'cloudCover');
                      const productTypeAttr = item.Attributes?.find((a: any) => a.Name === 'productType');
                      
                      return (
                        <tr 
                          key={item.Id} 
                          id={`row-${item.Id}`}
                          onClick={() => handleRowClick(item)}
                          className={`hover:bg-white/[0.02] transition-colors group cursor-pointer ${
                            selectedItemId === item.Id ? 'bg-emerald-500/10 border-l-2 border-l-emerald-500' : ''
                          }`}
                        >
                          <td className="px-6 py-4 text-xs font-medium text-zinc-300 max-w-xs truncate" title={item.Name}>
                            {item.Name}
                          </td>
                          <td className="px-6 py-4 text-xs font-mono text-zinc-400">
                            {new Date(item.ContentDate.Start).toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            {cloudAttr ? (
                              <div className="flex items-center gap-2">
                                <div className="w-12 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${
                                      cloudAttr.Value < 10 ? 'bg-emerald-500' : 
                                      cloudAttr.Value < 30 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${Math.min(100, cloudAttr.Value)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-mono text-zinc-400">{Math.round(cloudAttr.Value)}%</span>
                              </div>
                            ) : (
                              <span className="text-xs text-zinc-600 italic">N/A</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] px-2 py-0.5 bg-zinc-800 rounded-md border border-white/5 text-zinc-400 font-mono">
                              {productTypeAttr?.Value || 'Standard'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 rounded-md border border-emerald-500/20 text-emerald-400 font-mono">
                              {SATELLITES.find(s => s.collection === item.CollectionName)?.name || item.CollectionName}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <a 
                              href={`https://catalogue.dataspace.copernicus.eu/browser/?productId=${item.Id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-emerald-500 hover:text-zinc-950 rounded-lg transition-all text-xs font-medium text-zinc-300"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
