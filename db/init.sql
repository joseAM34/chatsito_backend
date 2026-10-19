BEGIN;

CREATE TABLE usuarios (
    id_usuario     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre         VARCHAR(100) NOT NULL,
    correo         VARCHAR(150) NOT NULL,
    password_hash  TEXT         NOT NULL,
    fecha_registro TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_usuarios_correo ON usuarios (LOWER(correo));

CREATE TABLE conversaciones (
    id_conversacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo            VARCHAR(10) NOT NULL
        CHECK (tipo IN ('privada', 'grupo')),
    nombre          VARCHAR(100),
    fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (tipo = 'grupo'   AND nombre IS NOT NULL)
        OR
        (tipo = 'privada' AND nombre IS NULL)
    )
);

CREATE TABLE participantes (
    id_conversacion BIGINT NOT NULL
        REFERENCES conversaciones(id_conversacion) ON DELETE CASCADE,
    id_usuario      BIGINT NOT NULL
        REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    fecha_union     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id_conversacion, id_usuario)
);

CREATE TABLE mensajes (
    id_mensaje      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_conversacion BIGINT NOT NULL,
    id_remitente    BIGINT NOT NULL,
    contenido       TEXT,
    tipo            VARCHAR(10) NOT NULL DEFAULT 'texto'
        CHECK (tipo IN ('texto', 'audio')),
    fecha_envio     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    editado_en      TIMESTAMPTZ,
    reenviado_de_id BIGINT
        REFERENCES mensajes(id_mensaje) ON DELETE SET NULL,

    FOREIGN KEY (id_conversacion, id_remitente)
        REFERENCES participantes(id_conversacion, id_usuario),

    CHECK (
        (tipo = 'texto' AND contenido IS NOT NULL)
        OR
        (tipo = 'audio' AND contenido IS NULL)
    ),
    CHECK (editado_en IS NULL OR tipo = 'texto'),
    CHECK (reenviado_de_id IS NULL OR reenviado_de_id <> id_mensaje),

    UNIQUE (id_conversacion, id_mensaje),
    UNIQUE (id_mensaje, tipo)
);

CREATE TABLE archivos (
    id_archivo        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_mensaje        BIGINT NOT NULL UNIQUE,
    tipo_mensaje      VARCHAR(10) NOT NULL DEFAULT 'audio'
        CHECK (tipo_mensaje = 'audio'),
    nombre            VARCHAR(255) NOT NULL,
    formato           VARCHAR(100) NOT NULL,
    tamano_bytes      BIGINT NOT NULL CHECK (tamano_bytes > 0),
    duracion_segundos INT CHECK (duracion_segundos > 0),
    object_key        TEXT NOT NULL UNIQUE,

    FOREIGN KEY (id_mensaje, tipo_mensaje)
        REFERENCES mensajes(id_mensaje, tipo) ON DELETE CASCADE
);

CREATE TABLE lecturas_mensajes (
    id_conversacion BIGINT NOT NULL,
    id_mensaje      BIGINT NOT NULL,
    id_usuario      BIGINT NOT NULL,
    fecha_lectura   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id_mensaje, id_usuario),

    FOREIGN KEY (id_conversacion, id_mensaje)
        REFERENCES mensajes(id_conversacion, id_mensaje) ON DELETE CASCADE,

    FOREIGN KEY (id_conversacion, id_usuario)
        REFERENCES participantes(id_conversacion, id_usuario) ON DELETE CASCADE
);

CREATE INDEX idx_participantes_usuario
    ON participantes(id_usuario);

CREATE INDEX idx_mensajes_conversacion_fecha
    ON mensajes(id_conversacion, fecha_envio);

CREATE INDEX idx_mensajes_remitente
    ON mensajes(id_remitente);

CREATE INDEX idx_lecturas_usuario
    ON lecturas_mensajes(id_usuario);

COMMIT;
