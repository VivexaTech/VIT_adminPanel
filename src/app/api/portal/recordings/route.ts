import { NextRequest, NextResponse } from "next/server";
import {
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RecordingVideo = {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
};

function getAdminDb() {
  if (!getApps().length) {
    const projectId =
      process.env.FIREBASE_ADMIN_PROJECT_ID;

    const clientEmail =
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

    const privateKey =
      process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
        /\\n/g,
        "\n"
      );

    if (
      !projectId ||
      !clientEmail ||
      !privateKey
    ) {
      throw new Error(
        "Firebase Admin environment variables are missing."
      );
    }

    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  return getFirestore();
}

function getPlaylistId(
  playlistUrl: string
): string | null {
  try {
    const url = new URL(
      playlistUrl.trim()
    );

    const playlistId =
      url.searchParams.get("list");

    return playlistId?.trim() || null;
  } catch {
    return null;
  }
}

async function getJsonResponse(
  response: Response
) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    console.error(
      "Non-JSON response received:",
      text.slice(0, 500)
    );

    return null;
  }
}

export async function GET(
  request: NextRequest
) {
  try {
    // -----------------------------------------
    // 1. Get batch ID
    // -----------------------------------------

    const batchId =
      request.nextUrl.searchParams
        .get("batchId")
        ?.trim();

    if (!batchId) {
      return NextResponse.json(
        {
          error:
            "Batch ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    // -----------------------------------------
    // 2. Get Firebase Admin Firestore
    // -----------------------------------------

    const db = getAdminDb();

    // -----------------------------------------
    // 3. Find batch
    // -----------------------------------------

    let batchData:
      | Record<string, any>
      | null = null;

    // First: document ID
    const directBatch = await db
      .collection("batches")
      .doc(batchId)
      .get();

    if (directBatch.exists) {
      batchData =
        directBatch.data() || null;
    }

    // Second: batchId field
    if (!batchData) {
      const querySnapshot = await db
        .collection("batches")
        .where(
          "batchId",
          "==",
          batchId
        )
        .limit(1)
        .get();

      if (!querySnapshot.empty) {
        batchData =
          querySnapshot.docs[0].data();
      }
    }

    if (!batchData) {
      return NextResponse.json(
        {
          error: "Batch not found.",
        },
        {
          status: 404,
        }
      );
    }

    // -----------------------------------------
    // 4. Get playlist URL
    // -----------------------------------------

    const playlistUrl = String(
      batchData.playlistUrl ??
        batchData.youtubePlaylistUrl ??
        batchData.youtubePlaylist ??
        ""
    ).trim();

    if (!playlistUrl) {
      return NextResponse.json(
        {
          error:
            "No recording playlist is configured for this batch.",
        },
        {
          status: 404,
        }
      );
    }

    // -----------------------------------------
    // 5. Extract playlist ID
    // -----------------------------------------

    const playlistId =
      getPlaylistId(playlistUrl);

    if (!playlistId) {
      return NextResponse.json(
        {
          error:
            "Invalid YouTube playlist URL.",
        },
        {
          status: 400,
        }
      );
    }

    // -----------------------------------------
    // 6. YouTube API key
    // -----------------------------------------

    const apiKey =
      process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      console.error(
        "YOUTUBE_API_KEY is missing."
      );

      return NextResponse.json(
        {
          error:
            "YouTube API is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    // -----------------------------------------
    // 7. Fetch playlist videos
    // -----------------------------------------

    const videos: RecordingVideo[] = [];

    let nextPageToken = "";

    do {
      const params =
        new URLSearchParams({
          part:
            "snippet,contentDetails",
          playlistId,
          maxResults: "50",
          key: apiKey,
        });

      if (nextPageToken) {
        params.set(
          "pageToken",
          nextPageToken
        );
      }

      const youtubeResponse =
        await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

      const youtubeData =
        await getJsonResponse(
          youtubeResponse
        );

      // ---------------------------------------
      // YouTube API error
      // ---------------------------------------

      if (!youtubeResponse.ok) {
        console.error(
          "YouTube API error:",
          youtubeData
        );

        const message =
          youtubeData?.error?.message ||
          `YouTube API request failed with status ${youtubeResponse.status}.`;

        return NextResponse.json(
          {
            error: message,
          },
          {
            status:
              youtubeResponse.status >=
                400 &&
              youtubeResponse.status < 600
                ? youtubeResponse.status
                : 502,
          }
        );
      }

      if (!youtubeData) {
        return NextResponse.json(
          {
            error:
              "YouTube returned an invalid response.",
          },
          {
            status: 502,
          }
        );
      }

      // ---------------------------------------
      // Playlist items
      // ---------------------------------------

      const items =
        Array.isArray(
          youtubeData.items
        )
          ? youtubeData.items
          : [];

      for (const item of items) {
        const videoId =
          item?.contentDetails
            ?.videoId;

        if (!videoId) {
          continue;
        }

        const title =
          item?.snippet?.title ||
          "Class Recording";

        const thumbnail =
          item?.snippet?.thumbnails
            ?.high?.url ||
          item?.snippet?.thumbnails
            ?.medium?.url ||
          item?.snippet?.thumbnails
            ?.default?.url ||
          "";

        const publishedAt =
          item?.snippet?.publishedAt ||
          "";

        videos.push({
          id: String(videoId),
          title: String(title),
          thumbnail: String(thumbnail),
          publishedAt: String(
            publishedAt
          ),
        });
      }

      nextPageToken =
        youtubeData.nextPageToken ||
        "";
    } while (nextPageToken);

    // -----------------------------------------
    // 8. Return only safe data
    // -----------------------------------------

    return NextResponse.json(
      {
        videos,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Recordings API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error.",
      },
      {
        status: 500,
      }
    );
  }
}