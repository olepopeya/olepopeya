#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const INDEX_PATH = join(PROJECT_ROOT, "index.html");

function readIndexHtml() {
  return readFileSync(INDEX_PATH, "utf-8");
}

function extractPhysicsConfig(html) {
  const config = {};

  const gravityMatch = html.match(/engine\.gravity\.y\s*=\s*([\d.]+)/);
  config.gravity = gravityMatch ? parseFloat(gravityMatch[1]) : null;

  const bgMatch = html.match(/background:\s*'(#[0-9a-fA-F]+)'/);
  config.backgroundColor = bgMatch ? bgMatch[1] : null;

  const bodyColorMatch = html.match(/const bodyColor\s*=\s*'(#[0-9a-fA-F]+)'/);
  config.bodyColor = bodyColorMatch ? bodyColorMatch[1] : null;

  const ropeColorMatch = html.match(/ctx\.strokeStyle\s*=\s*'(#[0-9a-fA-F]+)';\s*\n\s*ctx\.lineWidth\s*=\s*3/);
  config.ropeColor = ropeColorMatch ? ropeColorMatch[1] : null;

  const cubeFillMatch = html.match(/fillStyle:\s*'(#[0-9a-fA-F]+)',\s*strokeStyle:\s*'(#[0-9a-fA-F]+)',\s*lineWidth:\s*2\s*\}/);
  config.cubeFillColor = cubeFillMatch ? cubeFillMatch[1] : null;
  config.cubeStrokeColor = cubeFillMatch ? cubeFillMatch[2] : null;

  const frictionMatch = html.match(/const bodyOpts\s*=\s*\{[^}]*friction:\s*([\d.]+)/);
  config.bodyFriction = frictionMatch ? parseFloat(frictionMatch[1]) : null;

  const restitutionMatch = html.match(/const bodyOpts\s*=\s*\{[^}]*restitution:\s*([\d.]+)/);
  config.bodyRestitution = restitutionMatch ? parseFloat(restitutionMatch[1]) : null;

  const densityMatch = html.match(/const bodyOpts\s*=\s*\{[^}]*density:\s*([\d.]+)/);
  config.bodyDensity = densityMatch ? parseFloat(densityMatch[1]) : null;

  const stiffnessMatch = html.match(/const jointStiffness\s*=\s*([\d.]+)/);
  config.jointStiffness = stiffnessMatch ? parseFloat(stiffnessMatch[1]) : null;

  const ropeSegMatch = html.match(/const ropeSegments\s*=\s*(\d+)/);
  config.ropeSegments = ropeSegMatch ? parseInt(ropeSegMatch[1]) : null;

  const cubeSizeMatch = html.match(/const cubeSize\s*=\s*(\d+)\s*\*\s*S/);
  config.cubeSize = cubeSizeMatch ? parseInt(cubeSizeMatch[1]) : null;

  return config;
}

function applyConfigChange(html, param, value) {
  const replacements = {
    gravity: {
      pattern: /(engine\.gravity\.y\s*=\s*)([\d.]+)/,
      replace: `$1${value}`,
    },
    backgroundColor: {
      pattern: /(background:\s*')(#[0-9a-fA-F]+)(')/,
      replace: `$1${value}$3`,
    },
    bodyColor: {
      pattern: /(const bodyColor\s*=\s*')(#[0-9a-fA-F]+)(')/,
      replace: `$1${value}$3`,
    },
    ropeColor: {
      pattern: /(ctx\.strokeStyle\s*=\s*')(#[0-9a-fA-F]+)(';\s*\n\s*ctx\.lineWidth\s*=\s*3)/,
      replace: `$1${value}$3`,
    },
    cubeFillColor: {
      pattern: /(fillStyle:\s*')(#[0-9a-fA-F]+)(',\s*strokeStyle:\s*'#[0-9a-fA-F]+',\s*lineWidth:\s*2\s*\})/,
      replace: `$1${value}$3`,
    },
    cubeStrokeColor: {
      pattern: /(fillStyle:\s*'#[0-9a-fA-F]+',\s*strokeStyle:\s*')(#[0-9a-fA-F]+)(',\s*lineWidth:\s*2\s*\})/,
      replace: `$1${value}$3`,
    },
    bodyFriction: {
      pattern: /(const bodyOpts\s*=\s*\{[^}]*friction:\s*)([\d.]+)/,
      replace: `$1${value}`,
    },
    bodyRestitution: {
      pattern: /(const bodyOpts\s*=\s*\{[^}]*restitution:\s*)([\d.]+)/,
      replace: `$1${value}`,
    },
    bodyDensity: {
      pattern: /(const bodyOpts\s*=\s*\{[^}]*density:\s*)([\d.]+)/,
      replace: `$1${value}`,
    },
    jointStiffness: {
      pattern: /(const jointStiffness\s*=\s*)([\d.]+)/,
      replace: `$1${value}`,
    },
    ropeSegments: {
      pattern: /(const ropeSegments\s*=\s*)(\d+)/,
      replace: `$1${value}`,
    },
    cubeSize: {
      pattern: /(const cubeSize\s*=\s*)(\d+)(\s*\*\s*S)/,
      replace: `$1${value}$3`,
    },
  };

  const rule = replacements[param];
  if (!rule) {
    throw new Error(`Unknown parameter: ${param}. Valid parameters: ${Object.keys(replacements).join(", ")}`);
  }

  if (!rule.pattern.test(html)) {
    throw new Error(`Could not find pattern for "${param}" in index.html`);
  }

  return html.replace(rule.pattern, rule.replace);
}

const server = new McpServer({
  name: "olepopeya",
  version: "1.0.0",
});

server.resource(
  "source",
  "olepopeya://source/index.html",
  { description: "The full source code of the ragdoll physics app" },
  async () => ({
    contents: [
      {
        uri: "olepopeya://source/index.html",
        mimeType: "text/html",
        text: readIndexHtml(),
      },
    ],
  })
);

server.resource(
  "config",
  "olepopeya://config/physics",
  { description: "Current physics configuration parameters" },
  async () => ({
    contents: [
      {
        uri: "olepopeya://config/physics",
        mimeType: "application/json",
        text: JSON.stringify(extractPhysicsConfig(readIndexHtml()), null, 2),
      },
    ],
  })
);

server.tool(
  "get_physics_config",
  "Read the current physics configuration of the ragdoll app including gravity, colors, density, friction, and other parameters",
  {},
  async () => {
    const html = readIndexHtml();
    const config = extractPhysicsConfig(html);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(config, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "update_physics",
  "Update one or more physics parameters in the ragdoll app. Changes are written to index.html.",
  {
    changes: z
      .array(
        z.object({
          parameter: z.enum([
            "gravity",
            "backgroundColor",
            "bodyColor",
            "ropeColor",
            "cubeFillColor",
            "cubeStrokeColor",
            "bodyFriction",
            "bodyRestitution",
            "bodyDensity",
            "jointStiffness",
            "ropeSegments",
            "cubeSize",
          ]).describe("The parameter to change"),
          value: z.string().describe("The new value (numbers as strings, colors as hex like #ff0000)"),
        })
      )
      .describe("List of parameter changes to apply"),
  },
  async ({ changes }) => {
    let html = readIndexHtml();
    const applied = [];

    for (const { parameter, value } of changes) {
      html = applyConfigChange(html, parameter, value);
      applied.push(`${parameter} = ${value}`);
    }

    writeFileSync(INDEX_PATH, html, "utf-8");

    const newConfig = extractPhysicsConfig(html);
    return {
      content: [
        {
          type: "text",
          text: `Updated ${applied.length} parameter(s):\n${applied.map((a) => `  - ${a}`).join("\n")}\n\nCurrent config:\n${JSON.stringify(newConfig, null, 2)}`,
        },
      ],
    };
  }
);

server.tool(
  "get_scene_description",
  "Get a human-readable description of the current ragdoll physics scene setup",
  {},
  async () => {
    const config = extractPhysicsConfig(readIndexHtml());
    const lines = [
      "Ragdoll Physics Scene",
      "=====================",
      "",
      `A ragdoll figure hangs from a rope attached to the top of the screen.`,
      `The rope has ${config.ropeSegments} segments and is colored ${config.ropeColor}.`,
      `The ragdoll body is colored ${config.bodyColor} with joint stiffness of ${config.jointStiffness}.`,
      `Body physics: friction=${config.bodyFriction}, restitution=${config.bodyRestitution}, density=${config.bodyDensity}`,
      ``,
      `Below the ragdoll sits a draggable cube (size factor: ${config.cubeSize}) colored ${config.cubeFillColor}.`,
      ``,
      `Environment: gravity=${config.gravity}, background=${config.backgroundColor}`,
      ``,
      `The scene supports mouse/touch interaction for dragging objects.`,
    ];
    return {
      content: [{ type: "text", text: lines.join("\n") }],
    };
  }
);

server.tool(
  "reset_physics",
  "Reset all physics parameters to their default values",
  {},
  async () => {
    const defaults = [
      { parameter: "gravity", value: "1.5" },
      { parameter: "backgroundColor", value: "#000000" },
      { parameter: "bodyColor", value: "#d0d0d0" },
      { parameter: "ropeColor", value: "#e8c820" },
      { parameter: "cubeFillColor", value: "#ff0000" },
      { parameter: "cubeStrokeColor", value: "#cc0000" },
      { parameter: "bodyFriction", value: "0.5" },
      { parameter: "bodyRestitution", value: "0.15" },
      { parameter: "bodyDensity", value: "0.002" },
      { parameter: "jointStiffness", value: "0.6" },
      { parameter: "ropeSegments", value: "8" },
      { parameter: "cubeSize", value: "70" },
    ];

    let html = readIndexHtml();
    for (const { parameter, value } of defaults) {
      try {
        html = applyConfigChange(html, parameter, value);
      } catch {
        // skip if pattern not found
      }
    }
    writeFileSync(INDEX_PATH, html, "utf-8");

    return {
      content: [
        {
          type: "text",
          text: "All physics parameters reset to defaults.\n\n" +
            JSON.stringify(extractPhysicsConfig(html), null, 2),
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
