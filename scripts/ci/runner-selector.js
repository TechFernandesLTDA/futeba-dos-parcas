'use strict';

// Contrato único de seleção de runner (#4394). Os testes de contrato importam daqui para não
// repetir a expressão em cada arquivo.
//
// Runner próprio (Mac e prod-01 na OCI) só executa código de quem tem escrita no repositório:
// push, schedule, workflow_dispatch e pull_request de branch do próprio repo (exceto Dependabot).
// PR de fork, Dependabot, issues, comentários e workflow_run vão para o runner hospedado, que é
// gratuito em repositório público e descartável a cada job.

const TRUSTED_EVENT =
  "(contains(fromJSON('[\"push\",\"schedule\",\"workflow_dispatch\"]'), github.event_name) || " +
  "(github.event_name == 'pull_request' && !github.event.pull_request.head.repo.fork && " +
  "github.event.pull_request.user.login != 'dependabot[bot]'))";

const HOSTED_FALLBACK = '\'["ubuntu-24.04"]\'';

// Linha `runs-on:` de um job self-hosted. `vars` em ordem de preferência, sem o prefixo `vars.`.
function selfHostedRunsOn(...vars) {
  const chain = [...vars.map((name) => `vars.${name}`), HOSTED_FALLBACK].join(' || ');
  return `runs-on: \${{ fromJSON(${TRUSTED_EVENT} && (${chain}) || '"ubuntu-24.04"') }}`;
}

// Jobs iOS: Mac próprio para eventos confiáveis; macOS hospedado (gratuito em repo público) para o resto.
const MAC_IOS_RUNS_ON =
  `runs-on: \${{ fromJSON(${TRUSTED_EVENT} && '["self-hosted","macOS","ARM64","futeba"]' || '"macos-15"') }}`;

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const runsOnRegExp = (...vars) => new RegExp(escapeRegExp(selfHostedRunsOn(...vars)));

module.exports = {
  TRUSTED_EVENT,
  MAC_IOS_RUNS_ON,
  selfHostedRunsOn,
  runsOnRegExp,
  escapeRegExp,
};
