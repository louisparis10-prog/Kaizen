-- Schema Azure SQL Database (T-SQL) pour l'application Kaizen.
-- Idempotent : execute au demarrage, ne recree pas ce qui existe deja.
-- Traduit du schema SQLite d'origine (server.js) :
--   AUTOINCREMENT           -> INT IDENTITY(1,1)
--   DATETIME DEFAULT        -> DATETIME2 DEFAULT SYSUTCDATETIME()
--     CURRENT_TIMESTAMP
--   TEXT (JSON / base64)    -> NVARCHAR(MAX)
--   REAL                    -> FLOAT

IF OBJECT_ID(N'dbo.chantiers', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.chantiers (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        titre           NVARCHAR(MAX) NOT NULL,
        probleme        NVARCHAR(MAX) NULL,
        perimetre       NVARCHAR(MAX) NULL,
        pilote          NVARCHAR(MAX) NULL,
        equipe          NVARCHAR(MAX) NULL,   -- JSON : liste de noms
        objectif        NVARCHAR(MAX) NULL,
        outils          NVARCHAR(MAX) NULL,   -- JSON : liste d'ids d'outils, triee par phase
        date_debut      NVARCHAR(50) NULL,
        date_fin        NVARCHAR(50) NULL,
        statut          NVARCHAR(50) NOT NULL DEFAULT 'a_traiter',
        eligible_kaizen BIT NULL,
        quiz_reponses   NVARCHAR(MAX) NULL,   -- JSON : reponses au questionnaire
        created_at      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

IF OBJECT_ID(N'dbo.actions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.actions (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        chantier_id     INT NOT NULL,
        description     NVARCHAR(MAX) NOT NULL,
        responsable     NVARCHAR(MAX) NULL,
        echeance        NVARCHAR(50) NULL,
        statut          NVARCHAR(50) NOT NULL DEFAULT 'a_faire',
        created_at      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_actions_chantiers FOREIGN KEY (chantier_id)
            REFERENCES dbo.chantiers(id)
    );
END;

IF OBJECT_ID(N'dbo.indicateurs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.indicateurs (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        chantier_id     INT NOT NULL,
        nom             NVARCHAR(MAX) NOT NULL,
        unite           NVARCHAR(50) NULL,
        valeur_avant    FLOAT NULL,
        valeur_apres    FLOAT NULL,
        CONSTRAINT FK_indicateurs_chantiers FOREIGN KEY (chantier_id)
            REFERENCES dbo.chantiers(id)
    );
END;

IF OBJECT_ID(N'dbo.photos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.photos (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        chantier_id     INT NOT NULL,
        action_id       INT NULL,
        filename        NVARCHAR(MAX) NULL,
        mime_type       NVARCHAR(255) NULL,
        data            NVARCHAR(MAX) NOT NULL,  -- image encodee en base64
        created_at      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_photos_chantiers FOREIGN KEY (chantier_id)
            REFERENCES dbo.chantiers(id)
    );
END;
