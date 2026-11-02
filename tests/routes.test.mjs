import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const { getRoutes } = require('expo-router/build/getRoutes');
const appDirectory = new URL('../src/app/', import.meta.url);
const screens = readdirSync(appDirectory, { recursive: true }).filter(file => file.endsWith('.tsx'));
const sources = screens.map(file => ts.createSourceFile(file,
  readFileSync(new URL(file.replaceAll(path.sep, '/'), appDirectory), 'utf8'),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX));

// Check the source exports without evaluating native modules in Node.
test('all route and layout files default-export synchronous React component functions', () => {
  for (const source of sources) {
    const component = source.statements.find(statement => ts.isFunctionDeclaration(statement) &&
      statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword));
    assert.ok(component, `Missing default component in ${source.fileName}`);
    assert.ok(!component.modifiers.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword),
      `Async default component in ${source.fileName}`);
  }
});

// Use the installed Router's file-discovery algorithm; native UI rendering is tested on-device.
const modules = new Map(screens.map(file => [`./${file.replaceAll(path.sep, '/')}`, { default: function Screen() { return null; } }]));
const context = key => modules.get(key);
context.keys = () => [...modules.keys()];
const root = getRoutes(context, { platform: 'android', skipGenerated: true });
const routePaths = new Set();
function collect(route, parent = '') {
  const pathname = `${parent}/${route.route}`;
  if (route.type === 'route') routePaths.add(pathname.replace(/\/\([^/]+\)/g, '')
    .replace(/\/index$/, '').replace(/\/+/g, '/') || '/');
  for (const child of route.children || []) collect(child, pathname);
}
collect(root);

test('root, authentication screens and protected tab URLs are discoverable on Android', () => {
  assert.deepEqual([...routePaths].sort(), [
    '/', '/about', '/forgot-password', '/home', '/login', '/reset-password', '/sign-up', '/verify-code',
  ].sort());
});

test('every literal Router navigation target points to an existing public URL', () => {
  const targets = [];
  const form = ts.createSourceFile('account-form.tsx',
    readFileSync(new URL('../src/components/login/account-form.tsx', import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText() === 'router') {
      const target = node.arguments[0];
      if (target && ts.isStringLiteral(target)) targets.push(target.text);
      else if (target && ts.isObjectLiteralExpression(target)) {
        const pathname = target.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText() === 'pathname');
        if (pathname && ts.isStringLiteral(pathname.initializer)) targets.push(pathname.initializer.text);
      }
    }
    if (ts.isJsxAttribute(node) && node.name.getText() === 'href') {
      function literals(value) {
        if (ts.isStringLiteral(value)) targets.push(value.text);
        ts.forEachChild(value, literals);
      }
      if (node.initializer) literals(node.initializer);
    }
    ts.forEachChild(node, visit);
  }
  for (const source of [...sources, form]) visit(source);
  assert.ok(targets.length > 0);
  for (const target of targets) assert.ok(routePaths.has(target), `Unknown navigation target: ${target}`);
});
