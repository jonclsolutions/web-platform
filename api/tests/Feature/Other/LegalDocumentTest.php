<?php

/**
 * @file LegalDocumentTest.php
 * @path api/tests/Feature/Other/LegalDocumentTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the legal documents (DocumentTypeController,
 *   DocumentSectionController): document types, section administration per type and
 *   language, the public document with language fallback.
 * @dependencies
 * - Tests\TestCase.
 */

namespace Tests\Feature\Other;

use App\Models\Legal\DocumentSection;
use App\Models\Legal\DocumentType;
use Tests\TestCase;

/**
 * @description /api/legal/document-types, /api/legal/document-sections, GET /api/public/legal/{slug}.
 */
class LegalDocumentTest extends TestCase
{
    /** @var string[] All legal document permissions. */
    private const ALL = ['core-legal-documents-view', 'core-legal-documents-create', 'core-legal-documents-update', 'core-legal-documents-delete'];

    /**
     * @description Creates a document type.
     * @param string $slug Slug (gdpr, tos, cookies).
     * @return DocumentType
     */
    private function type(string $slug = 'gdpr'): DocumentType
    {
        return DocumentType::create(['slug' => $slug, 'title' => strtoupper($slug) . ' policy']);
    }

    /**
     * @description Creates a section.
     * @param DocumentType $type Owner type.
     * @param array<string, mixed> $attributes Column overrides.
     * @return DocumentSection
     */
    private function section(DocumentType $type, array $attributes = []): DocumentSection
    {
        return DocumentSection::create(array_merge(['document_type_id' => $type->id, 'position' => 0, 'heading' => 'Intro', 'content' => 'Text', 'lang' => 'cz'], $attributes));
    }

    /**
     * @description Document types (permission, by id) and the section list filtered by type
     *   and language, ordered by position.
     * @input Types gdpr, tos; gdpr sections cz pos 2 / cz pos 1 / en; tos section.
     * @output 403; types [gdpr, tos] with id/slug/title; gdpr+cz → positions [1, 2]; all 4 unfiltered.
     */
    public function test_types_and_section_list(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/legal/document-types')->assertStatus(403);
        $this->getJson('/api/legal/document-sections')->assertStatus(403);

        $this->signIn($this->userWith(['core-legal-documents-view']));
        $gdpr = $this->type();
        $tos = $this->type('tos');
        $second = $this->section($gdpr, ['position' => 2]);
        $first = $this->section($gdpr, ['position' => 1]);
        $this->section($gdpr, ['lang' => 'en']);
        $this->section($tos);

        $this->getJson('/api/legal/document-types')->assertOk()->assertExactJson([
            ['id' => $gdpr->id, 'slug' => 'gdpr', 'title' => 'GDPR policy'],
            ['id' => $tos->id, 'slug' => 'tos', 'title' => 'TOS policy'],
        ]);
        $this->getJson("/api/legal/document-sections?document_type_id={$gdpr->id}&lang=cz")->assertOk()->assertJsonPath('*.id', [$first->id, $second->id]);
        $this->getJson('/api/legal/document-sections')->assertJsonCount(4);
    }

    /**
     * @description Create / detail / edit / delete of a section with validation, 404s and
     *   database errors (logged into the core log).
     * @input POST valid / unknown type; GET; PUT {heading}; PUT {lang too long}; DELETE; /999; failures.
     * @output 201; 422; 200; 200 + core log; 422; 204; 404s; 500 messages.
     */
    public function test_section_crud(): void
    {
        $this->signIn($this->userWith(self::ALL));
        $type = $this->type();

        $id = $this->postJson('/api/legal/document-sections', ['document_type_id' => $type->id, 'heading' => 'Cookies', 'content' => 'We use…', 'lang' => 'en', 'position' => 3])
            ->assertCreated()->assertJsonPath('heading', 'Cookies')->assertJsonPath('position', 3)->json('id');
        $this->assertCoreLog('create', 'Created section: Cookies (en)');
        $this->postJson('/api/legal/document-sections', ['document_type_id' => 999, 'lang' => 'cz'])->assertStatus(422)->assertJsonValidationErrors(['document_type_id', 'content']);

        $this->getJson("/api/legal/document-sections/{$id}")->assertOk()->assertJsonPath('content', 'We use…');
        $this->getJson('/api/legal/document-sections/999')->assertStatus(404);
        $this->putJson("/api/legal/document-sections/{$id}", ['heading' => 'Cookie policy'])->assertOk()->assertJsonPath('heading', 'Cookie policy');
        $this->assertCoreLog('update', 'Updated section: Cookie policy (en)');
        $this->putJson("/api/legal/document-sections/{$id}", ['lang' => 'english'])->assertStatus(422);
        $this->putJson('/api/legal/document-sections/999', ['heading' => 'x'])->assertStatus(404);
        $this->deleteJson('/api/legal/document-sections/999')->assertStatus(404);

        $other = $this->section($type);
        $this->deleteJson("/api/legal/document-sections/{$id}")->assertNoContent();
        $this->assertNull(DocumentSection::find($id));
        $this->assertCoreLog('delete', 'Deleted section: Cookie policy');

        $this->failOn('document_sections', 'UPDATE');
        $this->putJson("/api/legal/document-sections/{$other->id}", ['heading' => 'Boom'])->assertStatus(500)->assertExactJson(['message' => 'Update failed.']);
        $this->failOn('document_sections', 'DELETE');
        $this->deleteJson("/api/legal/document-sections/{$other->id}")->assertStatus(500)->assertExactJson(['message' => 'Error deleting section.']);
        $this->failOn('document_sections', 'INSERT');
        $this->postJson('/api/legal/document-sections', ['document_type_id' => $type->id, 'content' => 'x', 'lang' => 'cz'])->assertStatus(500)->assertExactJson(['message' => 'Error creating section.']);
        $this->assertCoreLog('error', 'Error creating section');
    }

    /**
     * @description The public document: sections of the requested language (default cz),
     *   falling back to cz when the language has none; last update date and effective text;
     *   a document without sections; unknown slug 404.
     * @input gdpr: cz sections (updated 2026-05-01 / 2026-06-15), en section; tos without sections.
     * @output ?lang=en → en section; ?lang=de → cz sections, last_update 15.06.2026, footer text;
     *   tos → today, footer null, []; nope → 404.
     */
    public function test_public_document(): void
    {
        $gdpr = $this->type();
        $this->type('tos');
        $old = $this->section($gdpr, ['heading' => 'Old', 'position' => 1]);
        $old->forceFill(['updated_at' => '2026-05-01 10:00:00'])->save();
        $new = $this->section($gdpr, ['heading' => 'New', 'position' => 2]);
        $new->forceFill(['updated_at' => '2026-06-15 10:00:00'])->save();
        $this->section($gdpr, ['heading' => 'English', 'lang' => 'en']);

        $this->getJson('/api/public/legal/gdpr?lang=en')->assertOk()->assertJsonPath('sections.0.heading', 'English')->assertJsonCount(1, 'sections');
        $this->getJson('/api/public/legal/gdpr?lang=de')->assertOk()
            ->assertJsonPath('header_main', 'GDPR policy')->assertJsonPath('last_update_date', '15.06.2026')
            ->assertJsonPath('footer_effective', 'This policy is effective from 15.06.2026.')->assertJsonPath('sections.*.heading', ['Old', 'New']);
        $this->getJson('/api/public/legal/gdpr')->assertJsonCount(2, 'sections');
        $this->getJson('/api/public/legal/tos')->assertOk()->assertJsonPath('sections', [])
            ->assertJsonPath('footer_effective', null)->assertJsonPath('last_update_date', now()->format('d.m.Y'));
        $this->getJson('/api/public/legal/nope')->assertStatus(404)->assertExactJson(['message' => 'Document not found.']);
    }
}
