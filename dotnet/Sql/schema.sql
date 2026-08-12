IF OBJECT_ID(N'dbo.Chantiers', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Chantiers (
        Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Chantiers PRIMARY KEY,
        Titre NVARCHAR(500) NOT NULL,
        Probleme NVARCHAR(MAX) NOT NULL CONSTRAINT DF_Chantiers_Probleme DEFAULT N'',
        Perimetre NVARCHAR(500) NOT NULL CONSTRAINT DF_Chantiers_Perimetre DEFAULT N'',
        Pilote NVARCHAR(300) NOT NULL CONSTRAINT DF_Chantiers_Pilote DEFAULT N'',
        Equipe NVARCHAR(MAX) NOT NULL CONSTRAINT DF_Chantiers_Equipe DEFAULT N'[]',
        Objectif NVARCHAR(MAX) NOT NULL CONSTRAINT DF_Chantiers_Objectif DEFAULT N'',
        Outils NVARCHAR(MAX) NOT NULL CONSTRAINT DF_Chantiers_Outils DEFAULT N'[]',
        DateDebut NVARCHAR(20) NOT NULL CONSTRAINT DF_Chantiers_DateDebut DEFAULT N'',
        DateFin NVARCHAR(20) NOT NULL CONSTRAINT DF_Chantiers_DateFin DEFAULT N'',
        Statut NVARCHAR(30) NOT NULL CONSTRAINT DF_Chantiers_Statut DEFAULT N'a_traiter',
        EligibleKaizen INT NULL,
        QuizReponses NVARCHAR(MAX) NULL,
        CreatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_Chantiers_CreatedAt DEFAULT SYSDATETIMEOFFSET()
    );
END;

IF OBJECT_ID(N'dbo.Actions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Actions (
        Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Actions PRIMARY KEY,
        ChantierId INT NOT NULL,
        Description NVARCHAR(MAX) NOT NULL,
        Responsable NVARCHAR(300) NOT NULL CONSTRAINT DF_Actions_Responsable DEFAULT N'',
        Echeance NVARCHAR(20) NOT NULL CONSTRAINT DF_Actions_Echeance DEFAULT N'',
        Statut NVARCHAR(30) NOT NULL CONSTRAINT DF_Actions_Statut DEFAULT N'a_faire',
        CreatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_Actions_CreatedAt DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT FK_Actions_Chantiers FOREIGN KEY (ChantierId) REFERENCES dbo.Chantiers(Id)
    );
END;

IF OBJECT_ID(N'dbo.Indicateurs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Indicateurs (
        Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Indicateurs PRIMARY KEY,
        ChantierId INT NOT NULL,
        Nom NVARCHAR(500) NOT NULL,
        Unite NVARCHAR(100) NOT NULL CONSTRAINT DF_Indicateurs_Unite DEFAULT N'',
        ValeurAvant FLOAT NULL,
        ValeurApres FLOAT NULL,
        CONSTRAINT FK_Indicateurs_Chantiers FOREIGN KEY (ChantierId) REFERENCES dbo.Chantiers(Id)
    );
END;

IF OBJECT_ID(N'dbo.Photos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Photos (
        Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Photos PRIMARY KEY,
        ChantierId INT NOT NULL,
        ActionId INT NULL,
        OutilId NVARCHAR(150) NULL,
        Filename NVARCHAR(500) NOT NULL CONSTRAINT DF_Photos_Filename DEFAULT N'',
        MimeType NVARCHAR(150) NOT NULL CONSTRAINT DF_Photos_MimeType DEFAULT N'',
        Data NVARCHAR(MAX) NOT NULL,
        CreatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_Photos_CreatedAt DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT FK_Photos_Chantiers FOREIGN KEY (ChantierId) REFERENCES dbo.Chantiers(Id),
        CONSTRAINT FK_Photos_Actions FOREIGN KEY (ActionId) REFERENCES dbo.Actions(Id)
    );
END;

IF OBJECT_ID(N'dbo.Supports', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Supports (
        Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Supports PRIMARY KEY,
        ChantierId INT NOT NULL,
        OutilId NVARCHAR(150) NOT NULL,
        Donnees NVARCHAR(MAX) NOT NULL,
        CreatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_Supports_CreatedAt DEFAULT SYSDATETIMEOFFSET(),
        UpdatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_Supports_UpdatedAt DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT FK_Supports_Chantiers FOREIGN KEY (ChantierId) REFERENCES dbo.Chantiers(Id),
        CONSTRAINT UQ_Supports_Chantier_Outil UNIQUE (ChantierId, OutilId)
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Actions_ChantierId' AND object_id = OBJECT_ID(N'dbo.Actions'))
    CREATE INDEX IX_Actions_ChantierId ON dbo.Actions(ChantierId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Indicateurs_ChantierId' AND object_id = OBJECT_ID(N'dbo.Indicateurs'))
    CREATE INDEX IX_Indicateurs_ChantierId ON dbo.Indicateurs(ChantierId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Photos_ChantierId' AND object_id = OBJECT_ID(N'dbo.Photos'))
    CREATE INDEX IX_Photos_ChantierId ON dbo.Photos(ChantierId);
