<?php

/**
 * @file FolderTest.php
 * @path api/tests/Apps/JsCreator/Feature/FolderTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the folders of a workspace (FolderController, FolderTree):
 *   permissions, the tree rules (unique names, depth, no move into the own subtree), the trash
 *   of a whole subtree, restore, permanent deletion, and the isolation of workspaces - another
 *   account, the sysadmin included, never finds a folder that is not its own.
 * @dependencies Tests\TestCase, JsCreatorFixtures.
 */

namespace Tests\Apps\JsCreator\Feature;

use App\Apps\JsCreator\Models\CreatorFolder;
use App\Apps\JsCreator\Models\JsCreatorLog;
use Tests\Apps\JsCreator\Support\JsCreatorFixtures;
use Tests\TestCase;

/**
 * @description /api/js-creator/folders.
 */
class FolderTest extends TestCase
{
    use JsCreatorFixtures;

    /**
     * @description Creates a folder through the API and returns its id.
     * @param string $name Name.
     * @param int|null $parentId Parent.
     * @return int
     */
    private function folder(string $name, ?int $parentId = null): int
    {
        return $this->postJson('/api/js-creator/folders', ['name' => $name, 'parent_id' => $parentId])->assertCreated()->json('data.id');
    }

    /**
     * @description Each action needs its permission of a section; listing needs view.
     * @input Accounts without any, with view only, with view + create.
     * @output 403 list; 200 list + 403 create; 201 create.
     */
    public function test_permissions(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/js-creator/folders')->assertForbidden();

        $this->signIn($this->creator(['view']));
        $this->getJson('/api/js-creator/folders')->assertOk();
        $this->postJson('/api/js-creator/folders', ['name' => 'A'])->assertForbidden();

        $this->signIn($this->creator(['view', 'create']));
        $this->postJson('/api/js-creator/folders', ['name' => 'A'])->assertCreated()->assertJsonPath('data.parent_id', null);
    }

    /**
     * @description Names are unique among the siblings (case-insensitive, trimmed), the same name
     *   is fine under another parent; a control character is refused.
     * @input "Kampaně" twice at the top, " kampaně " again, "Kampaně" inside it, a name with a tab.
     * @output 201, 422 name, 422 name, 201, 422 name.
     */
    public function test_unique_names(): void
    {
        $this->signIn($this->creator());
        $id = $this->folder('Kampaně');
        $this->postJson('/api/js-creator/folders', ['name' => 'Kampaně'])->assertStatus(422)->assertJsonValidationErrors('name');
        $this->postJson('/api/js-creator/folders', ['name' => ' KAMPANĚ '])->assertStatus(422)->assertJsonValidationErrors('name');
        $this->folder('Kampaně', $id);
        $this->postJson('/api/js-creator/folders', ['name' => "A\tB"])->assertStatus(422)->assertJsonValidationErrors('name');
    }

    /**
     * @description At most 10 levels; a folder cannot move into itself or its subfolder; a moved
     *   subtree must fit into the depth limit too.
     * @input Chain of 10 folders; an 11th inside; move the first into the 3rd; move a 2-level
     *   subtree under the 9th level.
     * @output 422 parent_id each time; a valid move to the top works.
     */
    public function test_depth_and_moves(): void
    {
        $this->signIn($this->creator());
        $chain = [];
        $parent = null;
        for ($i = 1; $i <= 10; $i++) {
            $parent = $chain[] = $this->folder("L{$i}", $parent);
        }
        $this->postJson('/api/js-creator/folders', ['name' => 'L11', 'parent_id' => $parent])->assertStatus(422)->assertJsonValidationErrors('parent_id');

        $this->putJson("/api/js-creator/folders/{$chain[0]}", ['parent_id' => $chain[2]])->assertStatus(422)->assertJsonValidationErrors('parent_id');
        $this->putJson("/api/js-creator/folders/{$chain[0]}", ['parent_id' => $chain[0]])->assertStatus(422);

        $other = $this->folder('Other');
        $this->folder('Child', $other);
        $this->putJson("/api/js-creator/folders/{$other}", ['parent_id' => $chain[8]])->assertStatus(422)->assertJsonValidationErrors('parent_id');

        $this->putJson("/api/js-creator/folders/{$chain[5]}", ['parent_id' => null, 'name' => 'Top'])->assertOk()
            ->assertJsonPath('data.parent_id', null)->assertJsonPath('data.name', 'Top');
    }

    /**
     * @description Deleting a folder trashes its whole subtree as one item; restore brings it
     *   back; the audit log names ids only.
     * @input A > B > C, delete A, list, trash, restore A.
     * @output list empty; trash [A]; restore → A, B, C back; no log row contains a name.
     */
    public function test_trash_and_restore_of_a_subtree(): void
    {
        $this->signIn($this->creator());
        $a = $this->folder('Secret A');
        $b = $this->folder('Secret B', $a);
        $this->folder('Secret C', $b);

        $this->deleteJson("/api/js-creator/folders/{$a}")->assertNoContent();
        $this->getJson('/api/js-creator/folders')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/js-creator/folders?only_trashed=1')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $a);
        // A subfolder of a trashed subtree is not an item of the trash.
        $this->postJson("/api/js-creator/folders/{$b}/restore")->assertNotFound();

        $this->postJson("/api/js-creator/folders/{$a}/restore")->assertOk()->assertJsonPath('data.deleted_at', null);
        $this->getJson('/api/js-creator/folders')->assertJsonCount(3, 'data');
        $this->assertSame(0, JsCreatorLog::where('description', 'like', '%Secret%')->count());
    }

    /**
     * @description A restored folder whose parent is gone goes to the top level; a taken name
     *   gets " (2)".
     * @input P > X; delete X; create "X" at the top; delete P for good; restore X.
     * @output X at the top named "X (2)".
     */
    public function test_restore_to_the_top_with_a_free_name(): void
    {
        $this->signIn($this->creator());
        $p = $this->folder('P');
        $x = $this->folder('X', $p);
        $this->deleteJson("/api/js-creator/folders/{$x}")->assertNoContent();
        $this->folder('X');
        $this->deleteJson("/api/js-creator/folders/{$p}")->assertNoContent();
        $this->deleteJson("/api/js-creator/folders/{$p}?force=1")->assertNoContent();

        // X was in P's subtree - the permanent deletion of P took it too.
        $this->postJson("/api/js-creator/folders/{$x}/restore")->assertNotFound();

        $y = $this->folder('Y', $this->folder('Q'));
        $q = CreatorFolder::find($y)->parent_id;
        $this->deleteJson("/api/js-creator/folders/{$y}")->assertNoContent();
        $this->folder('Y');
        CreatorFolder::whereKey($q)->delete(); // parent missing (soft) - not an own visible folder
        $this->postJson("/api/js-creator/folders/{$y}/restore")->assertOk()
            ->assertJsonPath('data.parent_id', null)->assertJsonPath('data.name', 'Y (2)');
    }

    /**
     * @description Permanent deletion and emptying the trash remove the subtree rows.
     * @input A > B in the trash, C in the trash; force A; empty trash.
     * @output A, B gone after force; C gone after empty; force of a folder outside the trash 404.
     */
    public function test_permanent_deletion(): void
    {
        $this->signIn($this->creator());
        $a = $this->folder('A');
        $b = $this->folder('B', $a);
        $c = $this->folder('C');
        $this->deleteJson("/api/js-creator/folders/{$c}?force=1")->assertNotFound();

        $this->deleteJson("/api/js-creator/folders/{$a}")->assertNoContent();
        $this->deleteJson("/api/js-creator/folders/{$c}")->assertNoContent();
        $this->deleteJson("/api/js-creator/folders/{$a}?force=1")->assertNoContent();
        $this->assertNull(CreatorFolder::withTrashed()->find($b));

        $this->deleteJson('/api/js-creator/folders/trash')->assertNoContent();
        $this->assertSame(0, CreatorFolder::withTrashed()->count());
    }

    /**
     * @description Another account - also the sysadmin - finds no folder of a workspace: list,
     *   rename, move under it, delete, restore and force deletion answer 404.
     * @input Folder of A (and one in A's trash); requests of B and of a sysadmin.
     * @output empty lists, 404 everywhere; A's folders unchanged.
     */
    public function test_isolation_of_workspaces(): void
    {
        $owner = $this->signIn($this->creator());
        $own = $this->folder('Private');
        $trashed = $this->folder('Trashed');
        $this->deleteJson("/api/js-creator/folders/{$trashed}")->assertNoContent();

        foreach ([$this->creator(), $this->sysadmin()] as $other) {
            $this->signIn($other);
            $this->getJson('/api/js-creator/folders')->assertOk()->assertJsonCount(0, 'data');
            $this->getJson('/api/js-creator/folders?only_trashed=1')->assertOk()->assertJsonCount(0, 'data');
            $this->putJson("/api/js-creator/folders/{$own}", ['name' => 'Hacked'])->assertNotFound();
            $this->postJson('/api/js-creator/folders', ['name' => 'In', 'parent_id' => $own])->assertNotFound();
            $mine = $this->folder('Mine');
            $this->putJson("/api/js-creator/folders/{$mine}", ['parent_id' => $own])->assertNotFound();
            $this->deleteJson("/api/js-creator/folders/{$own}")->assertNotFound();
            $this->postJson("/api/js-creator/folders/{$trashed}/restore")->assertNotFound();
            $this->deleteJson("/api/js-creator/folders/{$trashed}?force=1")->assertNotFound();
        }

        $this->assertSame('Private', CreatorFolder::find($own)->name);
        $this->assertSame($owner->id, CreatorFolder::withTrashed()->find($trashed)->user_id);
    }
}
