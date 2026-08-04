using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Samhallsinformation.Migrations
{
    /// <inheritdoc />
    public partial class AddFeatureIdeas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FeatureIdeas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    IdeaNumber = table.Column<int>(type: "INTEGER", nullable: false),
                    Title = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: false),
                    Stage = table.Column<string>(type: "TEXT", nullable: false),
                    TriageKanGoras = table.Column<bool>(type: "INTEGER", nullable: true),
                    TriageBorGoras = table.Column<bool>(type: "INTEGER", nullable: true),
                    TriageMotivering = table.Column<string>(type: "TEXT", nullable: true),
                    KällaTyp = table.Column<string>(type: "TEXT", nullable: false),
                    SourceTicketId = table.Column<Guid>(type: "TEXT", nullable: true),
                    FlagKey = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeatureIdeas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FeatureIdeas_SupportTickets_SourceTicketId",
                        column: x => x.SourceTicketId,
                        principalTable: "SupportTickets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_FeatureIdeas_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FeatureIdeaChecklistItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    FeatureIdeaId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Label = table.Column<string>(type: "TEXT", nullable: false),
                    Done = table.Column<bool>(type: "INTEGER", nullable: false),
                    DoneAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    DoneByUserId = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeatureIdeaChecklistItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FeatureIdeaChecklistItems_FeatureIdeas_FeatureIdeaId",
                        column: x => x.FeatureIdeaId,
                        principalTable: "FeatureIdeas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FeatureIdeaChecklistItems_Users_DoneByUserId",
                        column: x => x.DoneByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "FeatureIdeaTesters",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    FeatureIdeaId = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    AddedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeatureIdeaTesters", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FeatureIdeaTesters_FeatureIdeas_FeatureIdeaId",
                        column: x => x.FeatureIdeaId,
                        principalTable: "FeatureIdeas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FeatureIdeaTesters_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FeatureIdeaChecklistItems_DoneByUserId",
                table: "FeatureIdeaChecklistItems",
                column: "DoneByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_FeatureIdeaChecklistItems_FeatureIdeaId",
                table: "FeatureIdeaChecklistItems",
                column: "FeatureIdeaId");

            migrationBuilder.CreateIndex(
                name: "IX_FeatureIdeas_CreatedByUserId",
                table: "FeatureIdeas",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_FeatureIdeas_IdeaNumber",
                table: "FeatureIdeas",
                column: "IdeaNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FeatureIdeas_SourceTicketId",
                table: "FeatureIdeas",
                column: "SourceTicketId");

            migrationBuilder.CreateIndex(
                name: "IX_FeatureIdeas_Stage",
                table: "FeatureIdeas",
                column: "Stage");

            migrationBuilder.CreateIndex(
                name: "IX_FeatureIdeaTesters_FeatureIdeaId_UserId",
                table: "FeatureIdeaTesters",
                columns: new[] { "FeatureIdeaId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FeatureIdeaTesters_UserId",
                table: "FeatureIdeaTesters",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FeatureIdeaChecklistItems");

            migrationBuilder.DropTable(
                name: "FeatureIdeaTesters");

            migrationBuilder.DropTable(
                name: "FeatureIdeas");
        }
    }
}
