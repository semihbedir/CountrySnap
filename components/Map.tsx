import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { GeoJSONCollection, GeoJSONFeature, GameStatus } from '../types';

interface MapProps {
  data: GeoJSONCollection | null;
  targetFeature: GeoJSONFeature | null;
  gameStatus: GameStatus;
  width: number;
  height: number;
}

const Map: React.FC<MapProps> = ({ data, targetFeature, gameStatus, width, height }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomBehavior = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!data || !svgRef.current || !gRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);
    
    // Clear previous render
    g.selectAll("*").remove();

    // Projection
    const projection = d3.geoNaturalEarth1()
      .scale(width / 6) // Initial scale
      .translate([width / 2, height / 2]);

    const pathGenerator = d3.geoPath().projection(projection);

    // Draw Countries
    g.selectAll("path")
      .data(data.features)
      .join("path")
      .attr("d", pathGenerator as any)
      .attr("class", "country")
      .attr("vector-effect", "non-scaling-stroke") // Keeps lines thin
      .attr("fill", "#1e293b") 
      .attr("stroke", "#475569") 
      .attr("stroke-width", 0.5);

    // Initialize Zoom Behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 100]) // Allow zooming from World view (1x) to detailed (100x)
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    zoomBehavior.current = zoom;
    svg.call(zoom);

    // Initial positioning
    svg.call(zoom.transform, d3.zoomIdentity);

    // Save projection and path for calculation logic
    (window as any).__path = pathGenerator;

  }, [data, width, height]);

  // Handle Zoom & Highlights based on targetFeature
  useEffect(() => {
    if (!gRef.current || !svgRef.current || !zoomBehavior.current) return;

    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);
    const zoom = zoomBehavior.current;

    // 1. Highlight Logic
    // Reset defaults
    g.selectAll("path")
      .attr("fill", "#1e293b")
      .attr("stroke", "#475569")
      .attr("stroke-width", 0.5);

    if (targetFeature) {
      g.selectAll("path")
        .filter((d: any) => d === targetFeature)
        .raise()
        .transition()
        .duration(750)
        .attr("fill", gameStatus === GameStatus.SUCCESS ? "#22c55e" : (gameStatus === GameStatus.FAILURE ? "#ef4444" : "#3b82f6"))
        .attr("stroke", "#f8fafc")
        .attr("stroke-width", 1.5);
    }

    // 2. Zoom Logic
    // Calculate target transform
    let transform = d3.zoomIdentity;

    // Only auto-zoom if we are in an active game state (playing or finished round)
    // IDLE state (start screen) defaults to zoomIdentity (world view)
    if (targetFeature && (gameStatus === GameStatus.PLAYING || gameStatus === GameStatus.SUCCESS || gameStatus === GameStatus.FAILURE)) {
      const pathGenerator = (window as any).__path;
      if (pathGenerator) {
        const bounds = pathGenerator.bounds(targetFeature);
        const dx = bounds[1][0] - bounds[0][0];
        const dy = bounds[1][1] - bounds[0][1];
        const x = (bounds[0][0] + bounds[1][0]) / 2;
        const y = (bounds[0][1] + bounds[1][1]) / 2;
        
        // Calculate scale
        // Padding: 0.85 ensures it doesn't touch edges
        const scale = Math.max(1, Math.min(50, 0.85 / Math.max(dx / width, dy / height)));
        
        // Transform: Center the feature on the screen
        transform = d3.zoomIdentity
          .translate(width / 2, height / 2)
          .scale(scale)
          .translate(-x, -y);
      }
    }

    // Apply Zoom via Transition
    // This updates the internal D3 zoom state and triggers the event listener to visually update <g>
    svg.transition()
      .duration(2000)
      .call(zoom.transform, transform);

  }, [targetFeature, gameStatus, width, height]);

  return (
    <div className="absolute inset-0 z-0 bg-slate-900 overflow-hidden">
      <svg 
        ref={svgRef} 
        width={width} 
        height={height} 
        className="w-full h-full block cursor-grab active:cursor-grabbing touch-none"
      >
        <rect width="100%" height="100%" fill="#0f172a" />
        <g ref={gRef}></g>
      </svg>
    </div>
  );
};

export default Map;