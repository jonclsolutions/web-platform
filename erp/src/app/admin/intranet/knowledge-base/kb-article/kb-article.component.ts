/**
 * @file kb-article.component.ts
 * @path src/app/admin/components/instranet/knowledge-base/kb-article/kb-article.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description A detail view component for displaying Knowledge Base articles based on route identifiers.
 * @dependencies
 * - ActivatedRoute: Used to extract article IDs from the URL parameters.
 */

import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/**
 * @description Renders a specific knowledge base article by resolving an ID against an internal data store.
 * @usage Used in the admin portal to provide employees with documentation and guidelines.
 * @note Currently utilizes an in-memory data object; should be extended to fetch data from an API service for production use.
 */
@Component({
  selector: 'app-kb-article',
  standalone: true,
  imports: [],
  templateUrl: './kb-article.component.html',
  styleUrls: ['./kb-article.component.css']
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

  /**
   * @description Subscribes to route parameters to identify the requested article ID and retrieve corresponding data.
   */
  ngOnInit() {
    this.route.params.subscribe(params => {
      const id = params['id'];
      this.article = this.kbData[id];
    });
  }
}