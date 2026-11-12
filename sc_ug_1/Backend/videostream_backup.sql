--
-- PostgreSQL database dump
--

\restrict 1LHQtkM0UtbVUx88YbJtLlOGWk0weaUMSXfSYs4AgD0ar2dswEFPEtl7vZzazgb

-- Dumped from database version 13.23
-- Dumped by pg_dump version 13.23

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: videos; Type: TABLE; Schema: public; Owner: videostream
--

CREATE TABLE public.videos (
    video_id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    upload_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    owner_id integer,
    status character varying(50),
    filename character varying(255)
);


ALTER TABLE public.videos OWNER TO videostream;

--
-- Name: videos_video_id_seq; Type: SEQUENCE; Schema: public; Owner: videostream
--

CREATE SEQUENCE public.videos_video_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.videos_video_id_seq OWNER TO videostream;

--
-- Name: videos_video_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: videostream
--

ALTER SEQUENCE public.videos_video_id_seq OWNED BY public.videos.video_id;


--
-- Name: videos video_id; Type: DEFAULT; Schema: public; Owner: videostream
--

ALTER TABLE ONLY public.videos ALTER COLUMN video_id SET DEFAULT nextval('public.videos_video_id_seq'::regclass);


--
-- Data for Name: videos; Type: TABLE DATA; Schema: public; Owner: videostream
--

COPY public.videos (video_id, title, description, upload_date, owner_id, status, filename) FROM stdin;
1	Test Video	First video on VM	2026-10-15 15:34:10.649492	1	uploaded	\N
2	My Second Video	Created from curl	2026-10-15 15:36:14.703152	1	uploaded	\N
6	My Real Video	Uploaded through API	2026-10-15 16:39:27.808694	1	uploaded	1792100367725.mp4
7	My Video	Example description	2026-10-16 18:39:08.080619	1	uploaded	\N
8	My Real Video	Uploaded through API	2026-10-16 18:56:23.544918	1	uploaded	1792194975961.mp4
9	My Real Video	Uploaded through API	2026-10-20 15:10:33.048001	1	uploaded	1792527032765.mp4
10	My Real Video	Uploaded through API	2026-10-22 13:06:39.400989	1	uploaded	1792692399166.mp4
11	bunny	laurentesting	2026-10-23 20:44:08.490259	1	uploaded	1792806248290.mp4
12	bunny	laurentesting	2026-10-23 22:23:51.101187	1	uploaded	1792812230812.mp4
13	big buck bunny	upload testing\r\n\r\nResolution: 854x480	2026-10-23 22:26:08.22824	1	uploaded	1792812367870.mp4
14	gfd	test2\r\n\r\nResolution: 854x480	2026-10-23 22:46:34.629449	1	uploaded	1792813594445.mp4
15	google colab	sdfsdfg\r\n\r\nCategory: Travel\r\nTags: ts=ags\r\nDuration: 01:21\r\nResolution: 1920x1080	2026-10-23 23:08:24.666108	1	uploaded	1792814903298.mp4
16	hello	testing3\r\n\r\nCategory: Music\r\nDuration: 00:30\r\nResolution: 854x480	2026-10-23 23:28:44.001286	1	uploaded	1792816123802.mp4
17	soccer	idk testing\r\n\r\nCategory: Sports\r\nDuration: 00:32\r\nResolution: 1280x720	2026-10-24 17:28:56.831806	1	uploaded	1792880935476.mp4
18	12345	1234\r\n\r\nCategory: Travel\r\nDuration: 00:30\r\nResolution: 854x480	2026-10-24 18:32:55.468525	1	uploaded	1792884775031.mp4
19	samplwe	123456\r\n\r\nCategory: Travel\r\nDuration: 00:10\r\nResolution: 640x360	2026-10-25 12:43:19.344675	1	uploaded	1792950199237.mp4
20	qwert	qwert\r\n\r\nCategory: Music\r\nDuration: 00:10\r\nResolution: 640x360	2026-10-25 13:14:50.712008	1	ready	hls/20/master.m3u8
21	big-buck-bunny	testing\r\n\r\nCategory: Vlog\r\nDuration: 00:30\r\nResolution: 854x480	2026-10-25 13:18:14.301023	1	ready	hls/21/master.m3u8
22	textinmotion	testtest\r\n\r\nCategory: Travel\r\nDuration: 00:30\r\nResolution: 1920x1080	2026-10-25 13:21:03.877119	1	processing	1792952463274.mp4
23	qwert	qwer\r\n\r\nCategory: Music\r\nDuration: 00:30\r\nResolution: 1920x1080	2026-10-25 13:22:16.456562	1	ready	hls/23/master.m3u8
24	soccer2	12345678wertyu\r\n\r\nCategory: Travel\r\nDuration: 00:32\r\nResolution: 1280x720	2026-10-25 13:46:09.219811	1	ready	hls/24/master.m3u8
\.


--
-- Name: videos_video_id_seq; Type: SEQUENCE SET; Schema: public; Owner: videostream
--

SELECT pg_catalog.setval('public.videos_video_id_seq', 24, true);


--
-- Name: videos videos_pkey; Type: CONSTRAINT; Schema: public; Owner: videostream
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_pkey PRIMARY KEY (video_id);


--
-- PostgreSQL database dump complete
--

\unrestrict 1LHQtkM0UtbVUx88YbJtLlOGWk0weaUMSXfSYs4AgD0ar2dswEFPEtl7vZzazgb

