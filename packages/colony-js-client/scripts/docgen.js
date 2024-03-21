#!/usr/bin/env node
/* eslint-disable */

const fs = require('fs');
const path = require('path');
const parser = require('flow-parser');
const types = require('ast-types');

const CONTRACT_CLIENTS = [
  {
    file: path.resolve(__dirname, '..', 'src', 'ColonyClient', 'index.js'),
    templateFile: path.resolve(__dirname, '..', 'docs', '_API_ColonyClient.template.md'),
    output: path.resolve(__dirname, '..', '..', '..', 'docs', '_API_ColonyClient.md'),
  },
  {
    file: path.resolve(__dirname, '..', 'src', 'ColonyNetworkClient', 'index.js'),
    templateFile: path.resolve(__dirname, '..', 'docs', '_API_ColonyNetworkClient.template.md'),
    output: path.resolve(__dirname, '..', '..', '..', 'docs', '_API_ColonyNetworkClient.md'),
  },
  {
    file: path.resolve(__dirname, '..', 'src', 'TokenClient', 'index.js'),
    templateFile: path.resolve(__dirname, '..', 'docs', '_API_TokenClient.template.md'),
    output: path.resolve(__dirname, '..', '..', '..', 'docs', '_API_TokenClient.md'),
  },
  {
    file: path.resolve(__dirname, '..', 'src', 'AuthorityClient', 'index.js'),
    templateFile: path.resolve(__dirname, '..', 'docs', '_API_AuthorityClient.template.md'),
    output: path.resolve(__dirname, '..', '..', '..', 'docs', '_API_AuthorityClient.md'),
  },
];

const TYPES = {
  BooleanTypeAnnotation: 'boolean',
  StringTypeAnnotation: 'string',
  NumberTypeAnnotation: 'number',
  Date: 'Date',
  Address: 'Address',
  BigNumber: 'BigNumber',
  Role: 'Role',
  AuthorityRole: 'Authority Role',
  IPFSHash: 'IPFS hash',
  TokenAddress: 'Token address',
  HexString: 'Hex string',
};

const generateMarkdown = ({ file, templateFile, output }) => {
  const ast = parser.parse(fs.readFileSync(file).toString());

  const callers = [];
  const senders = [];
  const multisig = [];
  const events = [];

  types.visit(ast, {
    visitQualifiedTypeIdentifier(p) {
      if (p.value.id.name === 'Caller') {
        const { params } = p.parent.value.typeParameters;

        callers.push({
          name: getName(p),
          description: getDescription(ast, p),
          args: mapObjectProps(ast, params[0]),
          returns: mapObjectProps(ast, params[1]),
        });
      }
      else if (p.value.id.name === 'Sender') {
        const { params } = p.parent.value.typeParameters;

        senders.push({
          name: getName(p),
          description: getDescription(ast, p),
          args: mapObjectProps(ast, params[0]),
          events: mapObjectProps(ast, params[1]),
        });
      }
      else if (p.value.id.name === 'MultisigSender') {
        const { params } = p.parent.value.typeParameters;

        multisig.push({
          name: getName(p),
          description: getDescription(ast, p),
          args: mapObjectProps(ast, params[0]),
          events: mapObjectProps(ast, params[1]),
        });
      }
      else if (p.value.id.name === 'Event') {
        const { params } = p.parent.value.typeParameters;

        events.push({
          name: getEventName(p),
          description: getDescription(ast, p),
          args: mapObjectProps(ast, params[0]),
        });
      }
      return false;
    },
  });

  const template = fs.readFileSync(templateFile).toString();

  const md = `
  ${template}
  ${printCallers(callers)}
  ${printSenders(senders, events)}
  ${printMultiSig(multisig, events)}
  ${printEvents(events)}
  `.trim();

  fs.writeFileSync(output, md);
};

CONTRACT_CLIENTS.forEach(generateMarkdown);

function printCallers(callers) {
  if (!callers.length) return '';
  // TODO: use templates to properly place this text into the file
  return `
## Callers

**All callers return promises which resolve to an object containing the given return values.** For a reference please check [here](/colonyjs/docs-contractclient/#callers).
` +
    callers
      .map(
        caller => `
### \`${caller.name}.call(${printArgs(caller.args, false)})\`

${caller.description}
${caller.args && caller.args.length ? '\n**Arguments**\n\n' : ''}${printProps('Argument', caller.args)}

**Returns**

A promise which resolves to an object containing the following properties:

${printProps('Return value', caller.returns)}
`,
    )
    .join('');
}

function printSenders(senders, events) {
  if (!senders.length) return '';
  // TODO: use templates to properly place this text into the file
  return `
## Senders

**All senders return an instance of a \`ContractResponse\`.** Every \`send()\` method takes an \`options\` object as the second argument. For a reference please check [here](/colonyjs/docs-contractclient/#senders).` +
    senders
      .map(
        sender => `
### \`${sender.name}.send(${printArgs(sender.args, true)})\`

${sender.description}
${sender.args && sender.args.length ? '\n**Arguments**\n\n' : ''}${printProps('Argument', sender.args)}

**Returns**

An instance of a \`ContractResponse\`${sender.events && sender.events.length ? ' which will eventually receive the following event data:' : ''}

${printProps('Event data', getEventProps(events, sender.events))}
`,
    )
    .join('');
}


function printEvents(events) {
  if (!events.length) return '';
  return `
## Events

Refer to the \`ContractEvent\` class [here](/colonyjs/docs-contractclient/#events) to interact with these events.

` + events.map(event => `
### [events.${event.name}.addListener((${printArgs(event.args)}) => { /* ... */ })](#events-${event.name})

${event.description}
${event.args && event.args.length ? '\n**Arguments**\n\n' : ''}${printProps('Argument', event.args)}

`).join('');
}

function printMultiSig(multisig, events) {
  if (!multisig.length) return '';
  // TODO: use templates to properly place this text into the file
  return `
## Task MultiSig

**All MultiSig functions return an instance of a \`MultiSigOperation\`.** For a reference please check [here](/colonyjs/docs-multisignature-transactions/).` +
    multisig
      .map(
        ms => `
### \`${ms.name}.startOperation(${printArgs(ms.args, false)})\`

${ms.description}
${ms.args && ms.args.length ? '\n**Arguments**\n\n' : ''}${printProps('Argument', ms.args)}

**Returns**

An instance of a \`MultiSigOperation\`${ms.events && ms.events.length ? ' whose sender will eventually receive the following event data:' : ''}

${printProps('Event Data', getEventProps(events, ms.events))}
`,
    )
    .join('');
}

function printProps(title, props) {
  if (props && props.length) {
    return `|${title}|Type|Description|
|---|---|---|
${props
      .map(param => `|${param.name}|${param.type}|${param.description}|`)
      .join('\n')}`;
  }
  return ``;
}

function getEventProps(contractEvents, methodEvents) {
  // List event props with the 'flat' args first (e.g. `taskId`), followed
  // by the 'nested' props (e.g. `TaskAdded`).
  return [].concat(...methodEvents.reduce((acc, methodEvent) => {
    const event = contractEvents.find(({ name }) => name === methodEvent.name);

    // Individual 'flat' args, which shouldn't be duplicated
    event.args
      .filter(arg => !acc[0].includes(({ name }) => name === arg.name))
      .forEach(arg => acc[0].push(arg));

    // The nested event object
    acc[1].push({
      name: event.name,
      type: 'object',
      description: getNestedEventDescription(event),
    });
    return acc;
  }, [[], []]));
}

function printArgs(args, withOpts) {
  if (args && args.length) {
    return `{ ${args.map(arg => arg.name).join(', ')} }${withOpts ? ', options' : ''}`;
  }
  return withOpts ? 'options' : '';
}

function mapObjectProps(ast, param) {
  if (param.type === 'ObjectTypeAnnotation') {
    return param.properties.map(prop => {
      const comment = ast.comments.find(
        c => c.loc.start.line === prop.key.loc.start.line,
      );
      return {
        name: prop.key.name,
        type: mapType(prop.value),
        description: formatDescription(comment && comment.value),
      };
    });
  }
}

function getName(p) {
  return p.parent.parent.parent.value.key.name;
}

function getDescription(ast, p) {
  const commentLine = p.parent.parent.parent.value.loc.start.line - 1;
  const comment = ast.comments.find(c => c.loc.end.line === commentLine);
  return formatDescription(comment && comment.value);
}

function getEventName(p) {
  return p.parentPath.parentPath.value.id
    ? p.parentPath.parentPath.value.id.name
    : p.parentPath.parentPath.value.key.name;
}

function getNestedEventDescription(event) {
  return `Contains the data defined in [${event.name}](#events-${event.name})`;
}

function formatDescription(str) {
  if (str) {
    const description = str
      .trim()
      .replace(
        /\[(.+)\]\((.+?)#(.+)\)/g,
        (_, $1, $2, $3) => `[${$1}](${$2}.html#${$3})`,
      );
    return description;
  }
  return '';
}

function mapType(type, optional = false) {
  if (type.type === 'NullableTypeAnnotation')
    return mapType(type.typeAnnotation, true);

  const name =
    type.type === 'GenericTypeAnnotation'
      ? TYPES[type.id.name]
      : TYPES[type.type];

  return optional ? `${name} (optional)` : name;
}
