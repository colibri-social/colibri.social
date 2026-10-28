#include <stdlib.h>
#include <vpx/vp8cx.h>
#include <vpx/vpx_encoder.h>

typedef struct colibri_vp8 {
  vpx_codec_ctx_t codec;
  vpx_image_t image;
  unsigned int width;
  unsigned int height;
  vpx_codec_iter_t iterator;
} colibri_vp8;

colibri_vp8 *colibri_vp8_open(unsigned int width, unsigned int height,
                              unsigned int kilobits, unsigned int threads,
                              unsigned int keyframe_interval, int speed) {
  vpx_codec_enc_cfg_t config;
  if (vpx_codec_enc_config_default(vpx_codec_vp8_cx(), &config, 0) !=
      VPX_CODEC_OK) {
    return NULL;
  }

  config.g_w = width;
  config.g_h = height;
  config.g_timebase.num = 1;
  config.g_timebase.den = 1000000;
  config.g_threads = threads;
  config.g_lag_in_frames = 0;
  config.g_error_resilient = VPX_ERROR_RESILIENT_DEFAULT;
  config.rc_end_usage = VPX_CBR;
  config.rc_target_bitrate = kilobits;
  config.rc_dropframe_thresh = 0;
  config.rc_min_quantizer = 2;
  config.rc_max_quantizer = 56;
  config.rc_undershoot_pct = 100;
  config.rc_overshoot_pct = 15;
  config.rc_buf_sz = 1000;
  config.rc_buf_initial_sz = 500;
  config.rc_buf_optimal_sz = 600;
  config.kf_mode = VPX_KF_AUTO;
  config.kf_min_dist = 0;
  config.kf_max_dist = keyframe_interval;

  colibri_vp8 *encoder = calloc(1, sizeof *encoder);
  if (encoder == NULL) {
    return NULL;
  }
  if (vpx_codec_enc_init(&encoder->codec, vpx_codec_vp8_cx(), &config, 0) !=
      VPX_CODEC_OK) {
    free(encoder);
    return NULL;
  }

  vpx_codec_control(&encoder->codec, VP8E_SET_CPUUSED, speed);
  vpx_codec_control(&encoder->codec, VP8E_SET_SCREEN_CONTENT_MODE, 1);
  vpx_codec_control(&encoder->codec, VP8E_SET_STATIC_THRESHOLD, 1);
  encoder->width = width;
  encoder->height = height;
  return encoder;
}

int colibri_vp8_encode(colibri_vp8 *encoder, unsigned char *planes,
                       long long timestamp, unsigned long duration,
                       int keyframe) {
  if (vpx_img_wrap(&encoder->image, VPX_IMG_FMT_I420, encoder->width,
                   encoder->height, 1, planes) == NULL) {
    return -1;
  }
  encoder->iterator = NULL;
  vpx_enc_frame_flags_t flags = keyframe ? VPX_EFLAG_FORCE_KF : 0;
  if (vpx_codec_encode(&encoder->codec, &encoder->image, timestamp, duration,
                       flags, VPX_DL_REALTIME) != VPX_CODEC_OK) {
    return -1;
  }
  return 0;
}

int colibri_vp8_next(colibri_vp8 *encoder, const unsigned char **data,
                     size_t *size, long long *timestamp, int *keyframe) {
  const vpx_codec_cx_pkt_t *packet;
  while ((packet = vpx_codec_get_cx_data(&encoder->codec,
                                         &encoder->iterator)) != NULL) {
    if (packet->kind != VPX_CODEC_CX_FRAME_PKT) {
      continue;
    }
    *data = packet->data.frame.buf;
    *size = packet->data.frame.sz;
    *timestamp = packet->data.frame.pts;
    *keyframe = (packet->data.frame.flags & VPX_FRAME_IS_KEY) != 0;
    return 1;
  }
  return 0;
}

void colibri_vp8_close(colibri_vp8 *encoder) {
  if (encoder == NULL) {
    return;
  }
  vpx_codec_destroy(&encoder->codec);
  free(encoder);
}
