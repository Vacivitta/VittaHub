import { Component } from '@angular/core';
import { PageHeading } from '../../shared/page-heading';
@Component({
  imports: [PageHeading],
  template: `
    <app-page-heading
      title="Administração"
      description="Uma visão inicial da organização e dos perfis previstos."
    />
    <div class="admin-banner">
      <strong>Prévia administrativa</strong>
      <p>
        Os perfis abaixo são ilustrativos. Esta tela não concede nem verifica permissões de acesso.
      </p>
    </div>
    <section class="panel admin-panel">
      <div class="section-heading">
        <h2>Pessoas de demonstração</h2>
        <span class="badge">3 exemplos</span>
      </div>
      <div class="table-scroll">
        <table>
          <caption class="sr-only">
            Pessoas fictícias e exemplos de perfis
          </caption>
          <thead>
            <tr>
              <th scope="col">Pessoa</th>
              <th scope="col">E-mail fictício</th>
              <th scope="col">Perfil ilustrativo</th>
            </tr>
          </thead>
          <tbody>
            @for (person of people; track person.email) {
              <tr>
                <td>
                  <strong>{{ person.name }}</strong>
                </td>
                <td>{{ person.email }}</td>
                <td>
                  <span class="badge">{{ person.role }}</span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
    <div class="admin-grid">
      <section class="panel admin-panel">
        <span class="eyebrow">QUADROS</span>
        <h2>Organização dos acessos</h2>
        <p class="muted">Administradores poderão autorizar quem cria e administra quadros.</p>
        <span class="badge">Configuração futura</span>
      </section>
      <section class="panel admin-panel">
        <span class="eyebrow">CONVERSAS</span>
        <h2>Grupos da equipe</h2>
        <p class="muted">
          Gestores e administradores poderão criar grupos e administrar participantes.
        </p>
        <span class="badge">Configuração futura</span>
      </section>
    </div>
  `,
})
export class Admin {
  readonly people = [
    { name: 'Pessoa Demo', email: 'pessoa.demo@example.invalid', role: 'Membro' },
    { name: 'Colega Alfa', email: 'alfa@example.invalid', role: 'Gestor' },
    { name: 'Colega Beta', email: 'beta@example.invalid', role: 'Administrador' },
  ];
}
