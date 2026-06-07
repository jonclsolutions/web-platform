import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';


@Component({
  selector: 'app-kb-article',
  standalone: true,
  imports: [],
  template: `
    @if (article) {
      <div class="article-container">
        <h1>{{ article.title }}</h1>
        <hr class="kb-divider">
        <div class="article-body" [innerHTML]="article.content"></div>
      </div>
    }
    `,
  styles: [`
    .article-container { animation: fadeIn 0.4s ease-out; }
    h1 { color: #a67dff; font-size: 2rem; margin-bottom: 10px; }
    .kb-divider { border: 0; border-top: 1px solid #2f2f2f; margin: 20px 0; }
    .article-body { line-height: 1.7; color: #d0d0d0; font-size: 1.1rem; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class KbArticleComponent implements OnInit {
  article: any;

  private kbData: any = {
    'uvod-pro-zamestnance': {
      title: 'Vítejte v týmu',
      content: '<p>Tento dokument obsahuje základní informace o fungování naší společnosti...</p><ul><li>Pracovní doba: Flexibilní</li><li>Komunikace: Discord / Email</li></ul>'
    },
    'prace-s-figmou': {
      title: 'Návod pro UI Designéry',
      content: '<p>Při práci ve Figmě dodržujte následující pravidla:</p><ol><li>Vždy používejte auto-layout.</li><li>Pojmenovávejte vrstvy anglicky.</li></ol>'
    }
  };

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      const id = params['id'];
      this.article = this.kbData[id];
    });
  }
}